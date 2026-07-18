// backend/src/controllers/announcement.controller.js
import prisma from "../config/database.js";

/**
 * Get announcements visible to the current user (not expired, matches
 * targeting on every non-empty dimension). Pinned first, then newest.
 * GET /api/announcements
 */
export const getMyAnnouncements = async (req, res) => {
  try {
    const { accessLevel, plottingCompanyId, divisionId } = req.user;
    const now = new Date();

    // Group/subgroup aren't on the JWT payload — resolve via the user's entity.
    let groupId = null;
    let subgroupId = null;
    if (plottingCompanyId) {
      const entity = await prisma.plottingCompany.findUnique({
        where: { id: plottingCompanyId },
        select: { groupId: true, subgroupId: true },
      });
      groupId = entity?.groupId || null;
      subgroupId = entity?.subgroupId || null;
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          {
            OR: [
              { targetAccessLevels: { isEmpty: true } },
              { targetAccessLevels: { has: accessLevel } },
            ],
          },
          {
            OR: [
              { targetEntityIds: { isEmpty: true } },
              { targetEntityIds: { has: plottingCompanyId || "" } },
            ],
          },
          {
            OR: [
              { targetGroupIds: { isEmpty: true } },
              { targetGroupIds: { has: groupId || "" } },
            ],
          },
          {
            OR: [
              { targetSubgroupIds: { isEmpty: true } },
              { targetSubgroupIds: { has: subgroupId || "" } },
            ],
          },
          {
            OR: [
              { targetDivisionIds: { isEmpty: true } },
              { targetDivisionIds: { has: divisionId || "" } },
            ],
          },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ success: true, data: announcements });
  } catch (error) {
    console.error("Get my announcements error:", error);
    return res.status(500).json({
      error: "Failed to fetch announcements",
      message: error.message,
    });
  }
};

/**
 * Get all announcements created within HR's scope, for management.
 * Level 1 sees all; Level 2 sees only announcements they created.
 * GET /api/announcements/manage
 */
export const getManagedAnnouncements = async (req, res) => {
  try {
    const { id: userId, accessLevel } = req.user;

    const where = accessLevel === 1 ? {} : { createdById: userId };

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ success: true, data: announcements });
  } catch (error) {
    console.error("Get managed announcements error:", error);
    return res.status(500).json({
      error: "Failed to fetch announcements",
      message: error.message,
    });
  }
};

// Level-2 HR may only target entities, groups, and subgroups within their own
// scope (scopeEntityIds / scopeGroupIds — same fields used everywhere else in
// the app, e.g. jobPosting.controller.js). Level 1 unrestricted.
async function validateTargetingScope(req, { targetEntityIds, targetGroupIds, targetSubgroupIds }) {
  if (req.user.accessLevel === 1) return null;

  const scopeEntityIds = req.user.scopeEntityIds || [];
  const scopeGroupIds = req.user.scopeGroupIds || [];

  const outOfScopeEntities = (targetEntityIds || []).filter((id) => !scopeEntityIds.includes(id));
  if (outOfScopeEntities.length > 0) {
    return "You can only target entities within your assigned scope";
  }

  const outOfScopeGroups = (targetGroupIds || []).filter((id) => !scopeGroupIds.includes(id));
  if (outOfScopeGroups.length > 0) {
    return "You can only target entity groups within your assigned scope";
  }

  if (targetSubgroupIds && targetSubgroupIds.length > 0) {
    const subgroups = await prisma.entitySubgroup.findMany({
      where: { id: { in: targetSubgroupIds } },
      select: { id: true, groupId: true },
    });
    const outOfScopeSubgroups = subgroups.filter((s) => !scopeGroupIds.includes(s.groupId));
    if (outOfScopeSubgroups.length > 0) {
      return "You can only target entity subgroups within your assigned scope";
    }
  }

  return null;
}

/**
 * Create an announcement.
 * POST /api/announcements
 * HR (Level 1-2)
 */
export const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      body,
      isPinned,
      expiresAt,
      targetAccessLevels,
      targetEntityIds,
      targetGroupIds,
      targetSubgroupIds,
      targetDivisionIds,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const scopeError = await validateTargetingScope(req, { targetEntityIds, targetGroupIds, targetSubgroupIds });
    if (scopeError) {
      return res.status(403).json({ error: scopeError });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        isPinned: !!isPinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetAccessLevels: targetAccessLevels || [],
        targetEntityIds: targetEntityIds || [],
        targetGroupIds: targetGroupIds || [],
        targetSubgroupIds: targetSubgroupIds || [],
        targetDivisionIds: targetDivisionIds || [],
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created",
      data: announcement,
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    return res.status(500).json({
      error: "Failed to create announcement",
      message: error.message,
    });
  }
};

/**
 * Update an announcement.
 * PUT /api/announcements/:id
 * HR (Level 1-2) — Level 2 may only edit their own
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      body,
      isPinned,
      expiresAt,
      targetAccessLevels,
      targetEntityIds,
      targetGroupIds,
      targetSubgroupIds,
      targetDivisionIds,
    } = req.body;

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    if (req.user.accessLevel !== 1 && existing.createdById !== req.user.id) {
      return res.status(403).json({ error: "You can only edit your own announcements" });
    }

    const scopeError = await validateTargetingScope(req, { targetEntityIds, targetGroupIds, targetSubgroupIds });
    if (scopeError) {
      return res.status(403).json({ error: scopeError });
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(isPinned !== undefined && { isPinned: !!isPinned }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(targetAccessLevels !== undefined && { targetAccessLevels }),
        ...(targetEntityIds !== undefined && { targetEntityIds }),
        ...(targetGroupIds !== undefined && { targetGroupIds }),
        ...(targetSubgroupIds !== undefined && { targetSubgroupIds }),
        ...(targetDivisionIds !== undefined && { targetDivisionIds }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.json({
      success: true,
      message: "Announcement updated",
      data: updated,
    });
  } catch (error) {
    console.error("Update announcement error:", error);
    return res.status(500).json({
      error: "Failed to update announcement",
      message: error.message,
    });
  }
};

/**
 * Delete an announcement.
 * DELETE /api/announcements/:id
 * HR (Level 1-2) — Level 2 may only delete their own
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    if (req.user.accessLevel !== 1 && existing.createdById !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own announcements" });
    }

    await prisma.announcement.delete({ where: { id } });

    return res.json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    return res.status(500).json({
      error: "Failed to delete announcement",
      message: error.message,
    });
  }
};
