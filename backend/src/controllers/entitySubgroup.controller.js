// backend/src/controllers/entitySubgroup.controller.js
import prisma from '../config/database.js';

const subgroupInclude = {
  group:     { select: { id: true, name: true, code: true, color: true } },
  companies: {
    where:   { isActive: true },
    select:  { id: true, name: true, code: true },
    orderBy: { code: 'asc' },
  },
  _count: {
    select: { companies: true },
  },
};

// GET /api/entity-subgroups
export const getAllSubgroups = async (req, res) => {
  try {
    const { groupId } = req.query;
    const where = { isActive: true };
    if (groupId) where.groupId = groupId;

    const subgroups = await prisma.entitySubgroup.findMany({
      where,
      include: subgroupInclude,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: subgroups });
  } catch (err) {
    console.error('[EntitySubgroup] getAllSubgroups error:', err);
    res.status(500).json({ error: 'Failed to fetch subgroups' });
  }
};

// GET /api/entity-subgroups/:id
export const getSubgroupById = async (req, res) => {
  try {
    const subgroup = await prisma.entitySubgroup.findUnique({
      where:   { id: req.params.id },
      include: subgroupInclude,
    });

    if (!subgroup) return res.status(404).json({ error: 'Subgroup not found' });
    res.json({ success: true, data: subgroup });
  } catch (err) {
    console.error('[EntitySubgroup] getSubgroupById error:', err);
    res.status(500).json({ error: 'Failed to fetch subgroup' });
  }
};

// POST /api/entity-subgroups
export const createSubgroup = async (req, res) => {
  try {
    const { name, code, description, color, groupId } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!groupId)      return res.status(400).json({ error: 'Parent group is required' });

    const subgroup = await prisma.entitySubgroup.create({
      data: {
        name:        name.trim(),
        code:        code?.trim().toUpperCase() || null,
        description: description || null,
        color:       color || '#6366F1',
        groupId,
      },
      include: subgroupInclude,
    });

    console.log(`[EntitySubgroup] Created "${subgroup.name}" by ${req.user?.name}`);
    res.status(201).json({ success: true, data: subgroup });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A subgroup with that name or code already exists' });
    }
    console.error('[EntitySubgroup] createSubgroup error:', err);
    res.status(500).json({ error: 'Failed to create subgroup' });
  }
};

// PUT /api/entity-subgroups/:id
export const updateSubgroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, color, groupId } = req.body;

    const data = {};
    if (name        !== undefined) data.name        = name.trim();
    if (code        !== undefined) data.code        = code?.trim().toUpperCase() || null;
    if (description !== undefined) data.description = description || null;
    if (color       !== undefined) data.color       = color;
    if (groupId     !== undefined) data.groupId     = groupId;

    const updated = await prisma.entitySubgroup.update({
      where: { id },
      data,
      include: subgroupInclude,
    });

    console.log(`[EntitySubgroup] Updated "${updated.name}" by ${req.user?.name}`);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subgroup not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Name or code already taken' });
    console.error('[EntitySubgroup] updateSubgroup error:', err);
    res.status(500).json({ error: 'Failed to update subgroup' });
  }
};

// DELETE /api/entity-subgroups/:id
export const deleteSubgroup = async (req, res) => {
  try {
    const { id } = req.params;

    const count = await prisma.plottingCompany.count({
      where: { subgroupId: id, isActive: true },
    });

    if (count > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${count} entities are still assigned. Remove them first.`,
      });
    }

    await prisma.entitySubgroup.update({
      where: { id },
      data:  { isActive: false },
    });

    console.log(`[EntitySubgroup] Deleted subgroup ${id} by ${req.user?.name}`);
    res.json({ success: true, message: 'Subgroup deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Subgroup not found' });
    console.error('[EntitySubgroup] deleteSubgroup error:', err);
    res.status(500).json({ error: 'Failed to delete subgroup' });
  }
};

// PUT /api/entity-subgroups/:id/assign-entities
// Body: { entityIds: string[] }
// Sets exactly these entityIds as the subgroup's members.
// Entities previously in this subgroup but not in the new list get subgroupId = null.
export const assignEntities = async (req, res) => {
  try {
    const { id }        = req.params;
    const { entityIds } = req.body;

    if (!Array.isArray(entityIds)) {
      return res.status(400).json({ error: 'entityIds must be an array' });
    }

    // Verify subgroup exists
    const subgroup = await prisma.entitySubgroup.findUnique({ where: { id } });
    if (!subgroup) return res.status(404).json({ error: 'Subgroup not found' });

    await prisma.$transaction([
      // Remove entities previously in this subgroup that aren't in new list
      prisma.plottingCompany.updateMany({
        where: { subgroupId: id, id: { notIn: entityIds } },
        data:  { subgroupId: null },
      }),
      // Assign new entities
      ...(entityIds.length > 0
        ? [
            prisma.plottingCompany.updateMany({
              where: { id: { in: entityIds } },
              data:  { subgroupId: id },
            }),
          ]
        : []),
    ]);

    const updated = await prisma.entitySubgroup.findUnique({
      where:   { id },
      include: subgroupInclude,
    });

    console.log(
      `[EntitySubgroup] Assigned ${entityIds.length} entities to "${subgroup.name}" by ${req.user?.name}`
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[EntitySubgroup] assignEntities error:', err);
    res.status(500).json({ error: 'Failed to assign entities' });
  }
};

// GET /api/entity-subgroups/:id/employees
// Returns all employees across all entities in this subgroup
export const getSubgroupEmployees = async (req, res) => {
  try {
    const { id } = req.params;

    const subgroup = await prisma.entitySubgroup.findUnique({
      where:  { id },
      select: { companies: { where: { isActive: true }, select: { id: true } } },
    });

    if (!subgroup) return res.status(404).json({ error: 'Subgroup not found' });

    const entityIds = subgroup.companies.map(c => c.id);

    const users = await prisma.user.findMany({
      where: {
        plottingCompanyId: { in: entityIds },
        employeeStatus:    { not: 'INACTIVE' },
      },
      select: {
        id:          true,
        name:        true,
        email:       true,
        nip:         true,
        accessLevel: true,
        division:    { select: { id: true, name: true } },
        supervisor:  { select: { id: true, name: true } },
        plottingCompany: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { plottingCompany: { code: 'asc' } },
        { name: 'asc' },
      ],
    });

    res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    console.error('[EntitySubgroup] getSubgroupEmployees error:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};
