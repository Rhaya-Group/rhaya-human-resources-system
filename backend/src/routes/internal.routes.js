// backend/src/routes/internal.routes.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { hmacAuth } from "../middleware/hmacAuth.js";
import {
  internalApiLimiter,
  strictInternalApiLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();
const prisma = new PrismaClient();

// Apply rate limiting to all internal routes
router.use(internalApiLimiter);

/**
 * GET /internal/entities
 * Returns entity list for Legal CRM
 */
router.get("/entities", hmacAuth, async (req, res, next) => {
  try {
    console.log("[Internal] GET /entities", {
      clientId: req.clientId,
      query: req.query,
    });

    const companies = await prisma.plottingCompany.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        groupId: true,
        group: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const entities = companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      description: company.description,
      isActive: company.isActive,
      groupId: company.groupId,
      group: company.group
        ? {
            id: company.group.id,
            code: company.group.code,
            name: company.group.name,
            color: company.group.color,
          }
        : null,
    }));

    res.json({
      success: true,
      count: entities.length,
      entities,
    });
  } catch (err) {
    console.error("[Internal] GET /entities error:", err);
    next(err);
  }
});

/**
 * GET /internal/employees
 * Returns employee list for inventory sync
 *
 * Query params:
 *   - since: ISO datetime, optional. Delta sync filter.
 *   - status: 'active' | 'inactive' | 'all' (default: 'all')
 *   - limit: number, optional. Max results to return (default: no limit)
 */
router.get("/employees", hmacAuth, async (req, res, next) => {
  try {
    const { since, status = "all", limit } = req.query;

    console.log("[Internal] GET /employees", {
      clientId: req.clientId,
      query: req.query,
    });

    // ✅ Validate parameters
    const where = {};

    // Validate and apply status filter
    if (status === "active") {
      where.employeeStatus = { notIn: ["Inactive", "Resigned", "Terminated"] };
    } else if (status === "inactive") {
      where.employeeStatus = { in: ["Inactive", "Resigned", "Terminated"] };
    } else if (status !== "all") {
      return res.status(400).json({
        error: "Invalid status parameter",
        allowed: ["active", "inactive", "all"],
      });
    }

    // ✅ Validate and apply since filter (delta sync)
    if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({
          error: "Invalid since parameter",
          message: "Must be a valid ISO 8601 datetime",
          example: "2024-01-01T00:00:00Z",
        });
      }
      where.updatedAt = { gte: sinceDate };
    }

    // ✅ Validate limit parameter
    let parsedLimit = undefined;
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return res.status(400).json({
          error: "Invalid limit parameter",
          message: "Must be a number between 1 and 1000",
        });
      }
    }

    // Fetch employees
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nip: true,
        name: true,
        email: true,
        phone: true,
        employeeStatus: true,
        joinDate: true,
        updatedAt: true,
        division: {
          select: {
            id: true,
            name: true,
          },
        },
        plottingCompany: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: parsedLimit,
    });

    const INACTIVE_STATUSES = ["Inactive", "Resigned", "Terminated"];

    const employees = users.map((u) => ({
      id: u.id,
      nip: u.nip,
      name: u.name,
      email: u.email,
      phone: u.phone,
      divisionId: u.division?.id ?? null,
      divisionName: u.division?.name ?? null,
      plottingCompanyId: u.plottingCompany?.id ?? null,
      plottingCompanyCode: u.plottingCompany?.code ?? null,
      plottingCompanyName: u.plottingCompany?.name ?? null,
      jobTitle: null, // TODO: Add if you have this field
      employeeStatus: u.employeeStatus,
      isActive: !INACTIVE_STATUSES.includes(u.employeeStatus),
      joinDate: u.joinDate,
      updatedAt: u.updatedAt,
    }));

    console.log("[Internal] GET /employees success", {
      clientId: req.clientId,
      count: employees.length,
      filtered: !!since || status !== "all",
    });

    res.json({
      syncedAt: new Date().toISOString(),
      count: employees.length,
      employees,
      // Include metadata for debugging
      _meta: {
        since: since || null,
        status,
        limit: parsedLimit || null,
      },
    });
  } catch (err) {
    console.error("[Internal] GET /employees error:", err);
    next(err);
  }
});

/**
 * GET /internal/employees/:id
 * Returns single employee details
 */
router.get("/employees/:id", hmacAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log("[Internal] GET /employees/:id", {
      clientId: req.clientId,
      employeeId: id,
    });

    // ✅ Validate ID format (CUID)
    if (!id || typeof id !== "string" || id.length < 10) {
      return res.status(400).json({
        error: "Invalid employee ID format",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nip: true,
        name: true,
        email: true,
        phone: true,
        employeeStatus: true,
        joinDate: true,
        updatedAt: true,
        division: {
          select: {
            id: true,
            name: true,
          },
        },
        plottingCompany: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      console.warn("[Internal] Employee not found", {
        clientId: req.clientId,
        employeeId: id,
      });
      return res.status(404).json({
        error: "Employee not found",
        id,
      });
    }

    const INACTIVE_STATUSES = ["Inactive", "Resigned", "Terminated"];

    const employee = {
      id: user.id,
      nip: user.nip,
      name: user.name,
      email: user.email,
      phone: user.phone,
      divisionId: user.division?.id ?? null,
      divisionName: user.division?.name ?? null,
      plottingCompanyId: user.plottingCompany?.id ?? null,
      plottingCompanyCode: user.plottingCompany?.code ?? null,
      plottingCompanyName: user.plottingCompany?.name ?? null,
      jobTitle: null,
      employeeStatus: user.employeeStatus,
      isActive: !INACTIVE_STATUSES.includes(user.employeeStatus),
      joinDate: user.joinDate,
      updatedAt: user.updatedAt,
    };

    console.log("[Internal] GET /employees/:id success", {
      clientId: req.clientId,
      employeeId: id,
      employeeName: user.name,
    });

    res.json(employee);
  } catch (err) {
    console.error("[Internal] GET /employees/:id error:", err);
    next(err);
  }
});

export default router;
