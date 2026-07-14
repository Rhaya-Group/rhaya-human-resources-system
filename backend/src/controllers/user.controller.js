// backend/src/controllers/user.controller.js
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { sendWelcomeEmailWithSetup } from "../services/welcomeEmail.service.js";
import {
  generateResetToken,
  hashToken,
  getTokenExpiration,
} from "../services/passwordResetToken.service.js";
import { applyScopeFilter } from "../utils/scopeHelper.js";
import { getUpcomingContractExpirations } from "../services/contractReminder.service.js";

const prisma = new PrismaClient();

/**
 * Get employees with contracts expiring soon (or already expired) for the
 * HR dashboard widget. Grouped into expired/h7/h14/h30 buckets.
 * GET /api/users/contract-expirations
 * HR (Level 1-2), Level-2 scoped to their assigned entities
 */
export const getContractExpirations = async (req, res) => {
  try {
    const where = applyScopeFilter({}, req.user);
    const buckets = await getUpcomingContractExpirations({ withinDays: 30, where });
    return res.json({ success: true, data: buckets });
  } catch (error) {
    console.error("Get contract expirations error:", error);
    return res.status(500).json({
      error: "Failed to fetch contract expirations",
      message: error.message,
    });
  }
};

/**
 * Get all users
 * GET /api/users
 */
// backend/src/controllers/user.controller.js

export const getAllUsers = async (req, res) => {
  try {
    const { search, divisionId, roleId, status, plottingCompanyId } = req.query;
    const { accessLevel, scopeEntityIds } = req.user;

    const currentYear = new Date().getFullYear();

    let where = {};

    if (accessLevel === 2) {
      if (!scopeEntityIds || scopeEntityIds.length === 0) {
        // No scope = no access
        return res.json({
          success: true,
          count: 0,
          data: [],
          message: "No entities assigned to your account",
        });
      }

      // Filter by scope
      where.plottingCompanyId = { in: scopeEntityIds };

      console.log(
        `[SCOPE] Level 2 user ${req.user.id} fetching users for entities:`,
        scopeEntityIds,
      );
    }

    // Apply other filters
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { nip: { contains: search, mode: "insensitive" } },
      ];
    }

    if (divisionId) where.divisionId = divisionId;
    if (roleId) where.roleId = roleId;
    if (status) where.employeeStatus = status;
    if (plottingCompanyId) where.plottingCompanyId = plottingCompanyId;

    const users = await prisma.user.findMany({
      where,
      include: {
        role: true,
        division: true,
        plottingCompany: true,
        overtimeBalance: {
          select: {
            currentBalance: true,
            pendingHours: true,
            totalPaid: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        leaveBalances: {
          where: { year: currentYear },
          select: {
            year: true,
            annualQuota: true,
            annualUsed: true,
            annualRemaining: true,
            sickLeaveUsed: true,
            menstrualLeaveUsed: true,
            toilBalance: true,
            toilUsed: true,
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    // Handle leaveBalances format - it's an array, take first element
    const usersWithFormattedBalance = users.map((user) => ({
      ...user,
      leaveBalance:
        user.leaveBalances && user.leaveBalances.length > 0 // ← Changed to plural
          ? user.leaveBalances[0] // ← Changed to plural
          : null,
      leaveBalances: undefined, // Remove the array, keep only leaveBalance (singular) for frontend
    }));

    console.log(
      `[USERS] Fetched ${usersWithFormattedBalance.length} users for Level ${accessLevel} admin`,
    );

    return res.json({
      success: true,
      count: usersWithFormattedBalance.length,
      data: usersWithFormattedBalance,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

/**
 * Get single user by ID (with balance data)
 * GET /api/users/:userId
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accessLevel, scopeEntityIds } = req.user;

    console.log("getUserById called:", {
      userId,
      adminLevel: accessLevel,
      adminScope: scopeEntityIds,
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plottingCompany: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        overtimeBalance: {
          select: {
            currentBalance: true,
            pendingHours: true,
            totalPaid: true,
          },
        },
        leaveBalances: {
          where: {
            year: new Date().getFullYear(),
          },
          select: {
            year: true,
            annualQuota: true,
            annualUsed: true,
            annualRemaining: true,
            sickLeaveUsed: true,
            menstrualLeaveUsed: true,
            toilBalance: true,
            toilUsed: true,
            toilExpired: true,
          },
          take: 1,
        },
        subordinates: {
          where: {
            employeeStatus: { not: "INACTIVE" },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    console.log("User found:", {
      id: user.id,
      name: user.name,
      plottingCompanyId: user.plottingCompanyId,
    });

    if (accessLevel === 2) {
      // Check if user's plottingCompanyId is in scope
      if (
        user.plottingCompanyId &&
        !scopeEntityIds?.includes(user.plottingCompanyId)
      ) {
        console.warn(
          `[SCOPE] Access denied: Level 2 admin ${req.user.id} tried to access user ${userId} outside scope`,
        );
        console.warn(
          `[SCOPE] User's entity: ${user.plottingCompanyId}, Admin's scope: ${JSON.stringify(scopeEntityIds)}`,
        );

        return res.status(403).json({
          error: "Access denied",
          message: "You do not have permission to access this user",
        });
      }
      // If user has no plottingCompanyId (admin user), also deny access
      if (!user.plottingCompanyId) {
        console.warn(
          `[SCOPE] Access denied: Level 2 admin tried to access admin user ${userId}`,
        );
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot access admin users",
        });
      }
    }

    console.log(
      `[ACCESS] User ${userId} accessed by admin ${req.user.id} (Level ${accessLevel})`,
    );

    // Format the response
    const formattedUser = {
      ...user,
      leaveBalance:
        user.leaveBalances && user.leaveBalances.length > 0
          ? user.leaveBalances[0]
          : null, // ← Changed to plural
      leaveBalances: undefined, // Remove array from response
    };

    return res.json({
      success: true,
      data: formattedUser,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      error: "Failed to fetch user",
      message: error.message,
    });
  }
};

/**
 * Create new user
 * POST /api/users/create
 */
export const createUser = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      name,
      nip,
      nik,
      npwp,
      phone,
      dateOfBirth,
      placeOfBirth,
      address,
      gender,
      bpjsHealth,
      bpjsEmployment,
      overtimeRate,
      accessLevel,
      roleId,
      divisionId,
      supervisorId,
      employeeStatus,
      joinDate,
      plottingCompanyId,
      contractStartDate,
      contractEndDate,
      companyType,
      sendActivationEmail,
      scopeEntityIds,
      scopeGroupIds,
    } = req.body;

    console.log("Creating user with accessLevel:", accessLevel);
    console.log("scopeEntityIds received:", scopeEntityIds);
    console.log("scopeGroupIds received:", scopeGroupIds);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with balances in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          name,
          nip,
          nik: nik || null,
          npwp: npwp || null,
          phone,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          placeOfBirth,
          address,
          gender: gender || "Male",
          bpjsHealth,
          bpjsEmployment,
          overtimeRate: overtimeRate || 300000,
          accessLevel: accessLevel || 4,
          roleId,
          divisionId,
          supervisorId: supervisorId || null,
          employeeStatus: employeeStatus || "PKWT",
          joinDate: joinDate ? new Date(joinDate) : new Date(),
          plottingCompanyId: plottingCompanyId || null,
          contractStartDate: contractStartDate
            ? new Date(contractStartDate)
            : null,
          contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
          companyType: companyType || "parent",
          scopeEntityIds:
            parseInt(accessLevel) === 2 && Array.isArray(scopeEntityIds)
              ? scopeEntityIds
              : [],
          scopeGroupIds:
            parseInt(accessLevel) === 2 && Array.isArray(scopeGroupIds)
              ? scopeGroupIds
              : [],
        },
        include: {
          role: true,
          division: true,
          supervisor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      console.log(
        `Created user: ${newUser.name} (Level ${newUser.accessLevel})`,
      );
      console.log(
        `scopeEntityIds saved: ${JSON.stringify(newUser.scopeEntityIds)}`,
      );
      console.log(
        `scopeGroupIds saved: ${JSON.stringify(newUser.scopeGroupIds)}`,
      );

      // 2. Create overtime balance
      const overtimeBalance = await tx.overtimeBalance.create({
        data: {
          employeeId: newUser.id,
          currentBalance: 0,
          pendingHours: 0,
          totalPaid: 0,
        },
      });

      console.log(`Created overtime balance for ${newUser.name}`);

      // 3. Create leave balance for current year
      const currentYear = new Date().getFullYear();
      const joinDateTime = new Date(joinDate || new Date());

      // Calculate annual quota based on employee status
      let annualQuota = 0;

      if (employeeStatus === "PKWTT") {
        // PKWTT automatically gets 14 days
        annualQuota = 14;
      } else if (employeeStatus === "PKWT") {
        // Calculate months since joining
        const now = new Date();
        const monthsSinceJoining =
          (now.getFullYear() - joinDateTime.getFullYear()) * 12 +
          (now.getMonth() - joinDateTime.getMonth());

        if (monthsSinceJoining >= 12) {
          // PKWT with 12+ months gets 14 days
          annualQuota = 14;
        } else {
          // PKWT with less than 12 months gets 10 days
          annualQuota = 10;
        }
      }
      // Other statuses (Intern, Contract, etc.) get 0 days - already set above

      const leaveBalance = await tx.leaveBalance.create({
        data: {
          employeeId: newUser.id,
          year: currentYear,
          annualQuota: annualQuota,
          annualUsed: 0,
          annualRemaining: annualQuota,
          sickLeaveUsed: 0,
          menstrualLeaveUsed: 0,
          unpaidLeaveUsed: 0,
        },
      });

      console.log(
        `Created leave balance for ${newUser.name} (status: ${employeeStatus}, quota: ${annualQuota} days)`,
      );

      return {
        user: newUser,
        overtimeBalance,
        leaveBalance,
      };
    });

    // Send activation email if requested
    if (sendActivationEmail) {
      try {
        console.log(`📧 Sending activation email to ${result.user.email}...`);

        // Generate password reset token
        const plainToken = generateResetToken();
        const hashedToken = await hashToken(plainToken);
        const expiresAt = getTokenExpiration(24); // 24 hours

        // Create reset token
        await prisma.passwordReset.create({
          data: {
            userId: result.user.id,
            token: hashedToken,
            expiresAt: expiresAt,
            ipAddress: "system-user-creation",
          },
        });

        // Send welcome email
        const emailResult = await sendWelcomeEmailWithSetup(
          {
            name: result.user.name,
            email: result.user.email,
            nip: result.user.nip,
          },
          plainToken,
        );

        if (emailResult.success) {
          console.log(`Activation email sent to ${result.user.email}`);
        } else {
          console.error(
            `❌ Failed to send activation email: ${emailResult.error}`,
          );
        }
      } catch (emailError) {
        console.error("Error sending activation email:", emailError);
        // Don't fail the user creation if email fails
      }
    }

    return res.status(201).json({
      success: true,
      message:
        "User created successfully" +
        (sendActivationEmail ? " and activation email sent" : ""),
      data: result.user,
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Username or email already exists",
      });
    }

    return res.status(500).json({
      error: "Failed to create user",
      message: error.message,
    });
  }
};

/**
 * Get accessible entities for current user
 * GET /api/users/accessible-entities
 */
export const getAccessibleEntities = async (req, res) => {
  try {
    const { accessLevel, scopeEntityIds } = req.user;

    let where = { isActive: true };

    // Level 2: Filter by scope
    if (accessLevel === 2) {
      if (!scopeEntityIds || scopeEntityIds.length === 0) {
        return res.json({ success: true, count: 0, data: [] });
      }
      where.id = { in: scopeEntityIds };
    }

    // Fetch entities
    const entities = await prisma.plottingCompany.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, isActive: true },
    });

    return res.json({ success: true, count: entities.length, data: entities });
  } catch (error) {
    console.error("Get accessible entities error:", error);
    return res.status(500).json({ error: "Failed to fetch entities" });
  }
};

export const hasSubordinates = async (req, res) => {
  const count = await prisma.user.count({
    where: {
      supervisorId: req.user.id,
      employeeStatus: { notIn: ["INACTIVE", "ADMIN"] },
    },
  });
  return res.json({ hasSubordinates: count > 0 });
};

/**
 * Update user
 * PUT /api/users/:userId
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      username,
      email,
      password,
      name,
      nip,
      nik,
      npwp,
      phone,
      dateOfBirth,
      placeOfBirth,
      address,
      gender,
      bpjsHealth,
      bpjsEmployment,
      overtimeRate,
      accessLevel,
      roleId,
      divisionId,
      supervisorId,
      employeeStatus,
      joinDate,
      plottingCompanyId,
      contractStartDate,
      contractEndDate,
      scopeEntityIds,
      scopeGroupIds,
    } = req.body;

    console.log("Updating user:", userId);
    console.log("New accessLevel:", accessLevel);
    console.log("New supervisorId:", supervisorId);
    // console.log("New scopeEntityIds:", scopeEntityIds);
    // console.log("New scopeGroupIds:", scopeGroupIds);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user.accessLevel === 2) {
      if (existingUser.accessLevel <= 2) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot edit administrators",
        });
      }

      // Cannot promote to admin
      if (accessLevel && parseInt(accessLevel) <= 2) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot promote users to administrator level",
        });
      }
    }

    if (req.user.accessLevel === 2) {
      if (existingUser.accessLevel >= 3) {
        if (
          !req.user.scopeEntityIds?.includes(existingUser.plottingCompanyId)
        ) {
          console.warn(
            `[SCOPE] Update denied: Level 2 admin tried to update user ${userId} outside scope`,
          );
          console.log(
            "Company ID:",
            existingUser.plottingCompanyId,
            "Scope:",
            !req.user.scopeEntityIds,
          );
          return res.status(403).json({
            error: "Access denied",
            message: "You cannot update users outside your scope",
          });
        }

        if (!existingUser.plottingCompanyId) {
          console.warn(
            `[SCOPE] Update denied: Level 2 admin tried to update admin user`,
          );
          return res.status(403).json({
            error: "Access denied",
            message: "You cannot update admin users",
          });
        }
      }
    }

    // Prepare update data
    const updateData = {
      username,
      email,
      name,
      nip,
      nik: nik || null,
      npwp: npwp || null,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      placeOfBirth,
      address,
      gender,
      bpjsHealth,
      bpjsEmployment,
      overtimeRate,
      accessLevel,
      roleId,
      divisionId,
      supervisorId: supervisorId || null,
      employeeStatus,
      joinDate: joinDate ? new Date(joinDate) : undefined,
      plottingCompanyId: plottingCompanyId || null,
      contractStartDate: contractStartDate
        ? new Date(contractStartDate)
        : undefined,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
    };

    if (accessLevel !== undefined) {
      const newAccessLevel = parseInt(accessLevel);

      if (newAccessLevel === 2) {
        // Level 2: Set scope (use provided or empty array)
        updateData.scopeEntityIds = Array.isArray(scopeEntityIds)
          ? scopeEntityIds
          : [];
        updateData.scopeGroupIds = Array.isArray(scopeGroupIds)
          ? scopeGroupIds
          : [];
        console.log(
          "Setting scopeEntityIds for Level 2:",
          updateData.scopeEntityIds,
        );
        console.log(
          "Setting scopeGroupIds for Level 2:",
          updateData.scopeGroupIds,
        );
      } else {
        // Non-Level 2: Clear scope
        updateData.scopeEntityIds = [];
        updateData.scopeGroupIds = [];
        console.log("Clearing scope for Level", newAccessLevel);
      }
    }

    // If password provided, hash it
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    // Update user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          role: true,
          division: true,
          plottingCompany: true,
          supervisor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // 2. Ensure overtime balance exists
      const overtimeBalance = await tx.overtimeBalance.upsert({
        where: { employeeId: userId },
        update: {},
        create: {
          employeeId: userId,
          currentBalance: 0,
          pendingHours: 0,
          totalPaid: 0,
        },
      });

      // 3. Ensure leave balance exists for current year
      const currentYear = new Date().getFullYear();
      const leaveBalance = await tx.leaveBalance.upsert({
        where: {
          employeeId_year: {
            employeeId: userId,
            year: currentYear,
          },
        },
        update: {},
        create: {
          employeeId: userId,
          year: currentYear,
          annualQuota: 14,
          annualUsed: 0,
          annualRemaining: 14,
          sickLeaveUsed: 0,
          menstrualLeaveUsed: 0,
          unpaidLeaveUsed: 0,
        },
      });

      console.log(
        `Updated user: ${updatedUser.name} (Level ${updatedUser.accessLevel})`,
      );
      console.log(`scopeEntityIds:`, updatedUser.scopeEntityIds);
      console.log(`scopeGroupIds:`, updatedUser.scopeGroupIds);
      console.log(`Ensured balances exist`);

      return updatedUser;
    });

    return res.json({
      success: true,
      message: "User updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update user error:", error);

    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Username or email already exists",
      });
    }

    return res.status(500).json({
      error: "Failed to update user",
      message: error.message,
    });
  }
};

/**
 * Get user profile (for logged-in user)
 * GET /api/users/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        overtimeBalance: true,
        leaveBalances: {
          // Changed to plural
          where: { year: new Date().getFullYear() },
          select: {
            year: true,
            annualQuota: true,
            annualUsed: true,
            annualRemaining: true,
            sickLeaveUsed: true,
            menstrualLeaveUsed: true,
            unpaidLeaveUsed: true,
            toilBalance: true, // Added TOIL
            toilUsed: true, // Added TOIL
            toilExpired: true, // Added TOIL
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password, ...userWithoutPassword } = user;

    return res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        leaveBalance: user.leaveBalances?.[0] || null, // Changed to plural with safe access
        leaveBalances: undefined, // Remove array from response
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      error: "Failed to fetch profile",
      message: error.message,
    });
  }
};

/**
 * Update own profile (limited fields)
 * PUT /api/users/profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, address, password, currentPassword } = req.body;

    const updateData = {};

    // Allow updating phone and address
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    // If updating password, verify current password
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({
          error: "Current password is required to set new password",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const validPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!validPassword) {
        return res.status(400).json({
          error: "Current password is incorrect",
        });
      }

      updateData.password = await bcrypt.hash(password, 10);
      updateData.lastPasswordChange = new Date();
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        role: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: userWithoutPassword,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      error: "Failed to update profile",
      message: error.message,
    });
  }
};

/**
 * Soft delete user (set employeeStatus to Inactive)
 * PUT /api/users/:userId/deactivate
 */
export const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accessLevel, scopeEntityIds } = req.user;

    console.log("Deactivate request for user:", userId);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        employeeStatus: true,
      },
    });

    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (accessLevel === 2) {
      if (
        user.plottingCompanyId &&
        !scopeEntityIds?.includes(user.plottingCompanyId)
      ) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot deactivate users outside your scope",
        });
      }
    }

    // Don't allow deactivating yourself
    if (req.user && req.user.id === userId) {
      console.log("❌ Attempt to deactivate own account");
      return res.status(400).json({
        error: "You cannot deactivate your own account",
      });
    }

    // Check if already inactive
    if (user.employeeStatus === "INACTIVE") {
      console.log("⚠️ User already inactive:", user.name);
      return res.status(400).json({
        error: "User is already inactive",
      });
    }

    // Set employeeStatus to Inactive
    const deactivatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        employeeStatus: "INACTIVE",
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeStatus: true,
      },
    });

    console.log(
      `User deactivated: ${deactivatedUser.name} (${deactivatedUser.email})`,
    );

    return res.json({
      success: true,
      message: `User ${deactivatedUser.name} has been deactivated`,
      data: {
        id: deactivatedUser.id,
        name: deactivatedUser.name,
        employeeStatus: deactivatedUser.employeeStatus,
      },
    });
  } catch (error) {
    console.error("❌ Deactivate user error:", error);

    return res.status(500).json({
      error: "Failed to deactivate user",
      message: error.message,
    });
  }
};

/**
 * Hard delete user (permanently remove from database)
 * DELETE /api/users/:userId/permanent
 */
export const permanentDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmUsername } = req.body;
    const { accessLevel, scopeEntityIds } = req.user;

    console.log("⚠️  PERMANENT delete request for user:", userId);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (accessLevel === 2) {
      if (
        user.plottingCompanyId &&
        !scopeEntityIds?.includes(user.plottingCompanyId)
      ) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot adjust balances for users outside your scope",
        });
      }
    }

    // Require username confirmation for safety
    if (confirmUsername !== user.username) {
      return res.status(400).json({
        error: "Username confirmation does not match",
        message: "Please type the username correctly to confirm deletion",
      });
    }

    // Don't allow deleting yourself
    if (req.user && req.user.id === userId) {
      return res.status(400).json({
        error: "You cannot delete your own account",
      });
    }

    // Delete all related records and user in transaction
    await prisma.$transaction(async (tx) => {
      console.log("Deleting related records...");

      // Delete balance adjustment logs
      await tx.balanceAdjustmentLog.deleteMany({
        where: { userId: userId },
      });

      // Delete overtime balance
      await tx.overtimeBalance.deleteMany({
        where: { employeeId: userId },
      });

      // Delete leave balance
      await tx.leaveBalance.deleteMany({
        where: { employeeId: userId },
      });

      // Delete leave requests (set employeeId to null or delete)
      await tx.leaveRequest.deleteMany({
        where: { employeeId: userId },
      });

      // Delete overtime requests
      await tx.overtimeRequest.deleteMany({
        where: { employeeId: userId },
      });

      // Update subordinates to have no supervisor
      await tx.user.updateMany({
        where: { supervisorId: userId },
        data: { supervisorId: null },
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId },
      });

      console.log("All related records deleted");
    });

    console.log(`User PERMANENTLY deleted: ${user.name} (${user.email})`);

    return res.json({
      success: true,
      message: `User ${user.name} has been permanently deleted`,
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("❌ Permanent delete error:", error);

    if (error.code === "P2003") {
      return res.status(400).json({
        error: "Cannot delete user due to related records",
        message: "This user has related data that prevents deletion",
      });
    }

    return res.status(500).json({
      error: "Failed to delete user permanently",
      message: error.message,
    });
  }
};

export const adjustUserBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { overtime, leave, toil } = req.body;
    const { accessLevel, scopeEntityIds } = req.user;

    // Check user exists
    const currentYear = new Date().getFullYear();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        overtimeBalance: true,
        leaveBalances: {
          where: { year: currentYear },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (accessLevel === 2) {
      if (
        user.plottingCompanyId &&
        !scopeEntityIds?.includes(user.plottingCompanyId)
      ) {
        return res.status(403).json({
          error: "Access denied",
          message: "You cannot adjust balances for users outside your scope",
        });
      }
    }

    // Get current year's leave balance
    const currentLeaveBalance =
      user.leaveBalances && user.leaveBalances.length > 0
        ? user.leaveBalances[0]
        : null;

    const results = {};

    // Adjust overtime balance
    if (overtime && overtime.amount !== undefined) {
      const currentBalance = user.overtimeBalance?.currentBalance || 0;
      const newBalance = currentBalance + parseFloat(overtime.amount);

      if (newBalance < 0) {
        return res.status(400).json({
          error: "Cannot reduce balance below zero",
          currentBalance,
          requested: overtime.amount,
        });
      }

      await prisma.overtimeBalance.upsert({
        where: { employeeId: userId },
        update: {
          currentBalance: newBalance,
        },
        create: {
          employeeId: userId,
          currentBalance: newBalance,
          totalPaid: 0,
        },
      });

      // Log the adjustment
      await prisma.balanceAdjustmentLog.create({
        data: {
          userId,
          adjustedBy: req.user.id,
          type: "OVERTIME",
          amount: overtime.amount,
          previousBalance: currentBalance,
          newBalance,
          reason: overtime.reason || "Manual adjustment by admin",
        },
      });

      results.overtime = {
        previousBalance: currentBalance,
        adjustment: overtime.amount,
        newBalance,
      };
    }

    // Adjust leave balance
    if (leave && leave.annualQuota !== undefined) {
      const year = leave.year || currentYear;

      const leaveBalance = await prisma.leaveBalance.upsert({
        where: {
          employeeId_year: {
            employeeId: userId,
            year,
          },
        },
        update: {
          annualQuota: leave.annualQuota,
          annualRemaining:
            leave.annualQuota - (currentLeaveBalance?.annualUsed || 0),
        },
        create: {
          employeeId: userId,
          year,
          annualQuota: leave.annualQuota,
          annualUsed: 0,
          annualRemaining: leave.annualQuota,
          sickLeaveUsed: 0,
          menstrualLeaveUsed: 0,
          unpaidLeaveUsed: 0,
          toilBalance: 0,
          toilUsed: 0,
          toilExpired: 0,
        },
      });

      // Log the adjustment
      await prisma.balanceAdjustmentLog.create({
        data: {
          userId,
          adjustedBy: req.user.id,
          type: "LEAVE",
          amount: leave.annualQuota,
          previousBalance: currentLeaveBalance?.annualQuota || 0,
          newBalance: leave.annualQuota,
          reason: leave.reason || "Manual adjustment by admin",
          year,
        },
      });

      results.leave = {
        year,
        previousQuota: currentLeaveBalance?.annualQuota || 0,
        newQuota: leave.annualQuota,
        remaining: leaveBalance.annualRemaining,
      };
    }

    // Adjust TOIL balance
    if (toil && toil.amount !== undefined) {
      if (!currentLeaveBalance) {
        return res.status(400).json({
          error: "Cannot adjust TOIL: No leave balance found for current year",
          message: "Please create leave balance first",
        });
      }

      if (!toil.reason || !toil.reason.trim()) {
        return res.status(400).json({
          error: "Please provide a reason for TOIL adjustment",
        });
      }

      const currentToilBalance = currentLeaveBalance.toilBalance || 0;
      const toilAmount = parseInt(toil.amount);
      const newToilBalance = currentToilBalance + toilAmount;

      if (newToilBalance < 0) {
        return res.status(400).json({
          error: "Cannot reduce TOIL balance below zero",
          currentBalance: currentToilBalance,
          requested: toilAmount,
        });
      }

      const updatedLeaveBalance = await prisma.leaveBalance.update({
        where: {
          employeeId_year: {
            employeeId: userId,
            year: currentYear,
          },
        },
        data: {
          toilBalance: newToilBalance,
        },
      });

      // Log the adjustment
      await prisma.balanceAdjustmentLog.create({
        data: {
          userId,
          adjustedBy: req.user.id,
          type: "TOIL",
          amount: toilAmount,
          previousBalance: currentToilBalance,
          newBalance: newToilBalance,
          reason: toil.reason,
          year: currentYear,
        },
      });

      results.toil = {
        year: currentYear,
        previousBalance: currentToilBalance,
        adjustment: toilAmount,
        newBalance: newToilBalance,
      };
    }

    return res.json({
      success: true,
      message: "Balance adjusted successfully",
      data: results,
    });
  } catch (error) {
    console.error("Adjust balance error:", error);
    return res.status(500).json({
      error: "Failed to adjust balance",
      message: error.message,
    });
  }
};
