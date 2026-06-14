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
 * GET /internal/entity-groups
 * Returns entity group list for Legal CRM
 *
 * Query params:
 *   - since: ISO datetime, optional. Delta sync filter.
 */
router.get("/entity-groups", hmacAuth, async (req, res, next) => {
  try {
    const { since } = req.query;

    console.log("[Internal] GET /entity-groups", {
      clientId: req.clientId,
      query: req.query,
    });

    const where = { isActive: true };

    // ✅ Validate since parameter
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

    const groups = await prisma.entityGroup.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });

    const entityGroups = groups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      description: g.description,
      color: g.color,
      isActive: g.isActive,
      entityCount: g._count.companies,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));

    console.log("[Internal] GET /entity-groups success", {
      clientId: req.clientId,
      count: entityGroups.length,
      filtered: !!since,
    });

    res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      count: entityGroups.length,
      entityGroups,
      _meta: {
        since: since || null,
      },
    });
  } catch (err) {
    console.error("[Internal] GET /entity-groups error:", err);
    next(err);
  }
});

/**
 * GET /internal/entities
 * Returns entity list for Legal CRM
 *
 * Response includes both entities and groups arrays for compatibility
 * with Legal CRM's entitySync.service.js
 */
router.get("/entities", hmacAuth, async (req, res, next) => {
  try {
    console.log("[Internal] GET /entities", {
      clientId: req.clientId,
      query: req.query,
    });

    // Fetch entities with group relation
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
            description: true,
            color: true,
            isActive: true,
          },
        },
        subgroupId: true,
        subgroup: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            color: true,
            isActive: true,
            groupId: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });

    // Fetch all active entity subgroups
    const entitySubgroups = await prisma.entitySubgroup.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        color: true,
        isActive: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    // Fetch all active entity groups
    const entityGroups = await prisma.entityGroup.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { code: "asc" },
    });

    // Map entities to include employee count and group reference
    const entities = companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
      description: company.description,
      isActive: company.isActive,
      employeeCount: company._count?.users ?? 0,
      groupId: company.groupId,
      group: company.group
        ? {
            id: company.group.id,
            code: company.group.code,
            name: company.group.name,
            description: company.group.description,
            color: company.group.color,
            isActive: company.group.isActive,
          }
        : null,
      subgroupId: company.subgroupId,
      subgroup: company.subgroup
        ? {
            id: company.subgroup.id,
            code: company.subgroup.code,
            name: company.subgroup.name,
            description: company.subgroup.description,
            color: company.subgroup.color,
            isActive: company.subgroup.isActive,
            groupId: company.subgroup.groupId,
          }
        : null,
    }));

    // Map subgroups for Legal CRM sync
    const subgroups = entitySubgroups.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      color: s.color,
      isActive: s.isActive,
      groupId: s.groupId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    // Map groups for Legal CRM's group sync
    const groups = entityGroups.map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      description: g.description,
      color: g.color,
      isActive: g.isActive,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));

    console.log("[Internal] GET /entities success", {
      clientId: req.clientId,
      entityCount: entities.length,
      groupCount: groups.length,
      subgroupCount: subgroups.length,
    });

    res.json({
      success: true,
      count: entities.length,
      entities,
      groups,
      subgroups,
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

    // Validate ID format (CUID)
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

    const INACTIVE_STATUSES = ["INACTIVE", "Resigned", "Terminated"];

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
