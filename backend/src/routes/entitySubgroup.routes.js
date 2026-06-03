// backend/src/routes/entitySubgroup.routes.js
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getAllSubgroups,
  getSubgroupById,
  createSubgroup,
  updateSubgroup,
  deleteSubgroup,
  assignEntities,
  getSubgroupEmployees,
} from '../controllers/entitySubgroup.controller.js';

const router = express.Router();
router.use(authenticate);

// GET  /api/entity-subgroups                        — all subgroups (L1-L2)
// GET  /api/entity-subgroups/:id                    — single subgroup (L1-L2)
// GET  /api/entity-subgroups/:id/employees          — employees in subgroup (L1-L2)
// POST /api/entity-subgroups                        — create (L1 only)
// PUT  /api/entity-subgroups/:id                    — update (L1 only)
// PUT  /api/entity-subgroups/:id/assign-entities    — assign entities (L1 only)
// DELETE /api/entity-subgroups/:id                  — delete (L1 only)

router.get('/',                          requireRole([1, 2]), getAllSubgroups);
router.get('/:id',                       requireRole([1, 2]), getSubgroupById);
router.get('/:id/employees',             requireRole([1, 2]), getSubgroupEmployees);
router.post('/',                         requireRole([1]),    createSubgroup);
router.put('/:id',                       requireRole([1]),    updateSubgroup);
router.put('/:id/assign-entities',       requireRole([1]),    assignEntities);
router.delete('/:id',                    requireRole([1]),    deleteSubgroup);

export default router;
