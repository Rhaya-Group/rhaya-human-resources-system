// backend/src/services/overtimeRevision.service.js
// Complete revision tracking service for overtime requests

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Revision Action Types
 * These define all the actions we track in the overtime workflow
 */
export const REVISION_ACTIONS = {
  SUBMITTED: 'SUBMITTED',                         // Initial submission (post-mode)
  PLAN_SUBMITTED: 'PLAN_SUBMITTED',               // Plan submitted (pre-mode, flow2a)
  EDITED: 'EDITED',                               // Employee edited request
  APPROVED_SUPERVISOR: 'APPROVED_SUPERVISOR',     // Supervisor approved (post-mode)
  REJECTED_SUPERVISOR: 'REJECTED_SUPERVISOR',     // Supervisor rejected
  PLAN_APPROVED_SPV: 'PLAN_APPROVED_SPV',         // Supervisor approved the plan (pre-mode)
  APPROVED_DIVHEAD: 'APPROVED_DIVHEAD',           // Division head approved
  REJECTED_DIVHEAD: 'REJECTED_DIVHEAD',           // Division head rejected
  REVISION_REQUESTED: 'REVISION_REQUESTED',       // Revision requested
  ADMIN_REJECTED: 'ADMIN_REJECTED',               // Admin override rejection
  ADMIN_EDITED_APPROVED: 'ADMIN_EDITED_APPROVED', // Admin edited approved overtime
  ADMIN_EDITED_REJECTED: 'ADMIN_EDITED_REJECTED', // Admin edited rejected overtime
  FINAL_APPROVED: 'FINAL_APPROVED',               // Final approval
  FINAL_REJECTED: 'FINAL_REJECTED',               // Final rejection
  MOVED_TO_ACTUALIZATION: 'MOVED_TO_ACTUALIZATION', // Scheduler moved plan to actualization queue
  ACTUALIZED: 'ACTUALIZED',                       // Employee submitted actual hours
  DELETED: 'DELETED'                              // Request deleted
};

/**
 * Log a revision/action on an overtime request
 * This creates an immutable audit trail entry
 * 
 * @param {Object} params
 * @param {string} params.overtimeRequestId - ID of overtime request
 * @param {string} params.revisedBy - User ID who performed action
 * @param {string} params.action - Action type from REVISION_ACTIONS
 * @param {Object} params.changes - Data about what changed
 * @param {string} params.comment - Optional comment/reason
 * @returns {Promise<Object|null>} Created revision or null if failed
 */
export const logRevision = async ({
  overtimeRequestId,
  revisedBy,
  action,
  changes = {},
  comment = null
}) => {
  try {
    console.log(`[Revision] Logging ${action} for overtime ${overtimeRequestId} by user ${revisedBy}`);

    const revision = await prisma.overtimeRevision.create({
      data: {
        overtimeRequestId,
        revisedBy,
        action,
        changes,
        comment
      },
      include: {
        reviser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    console.log(`✅ Revision logged: ${action} at ${revision.createdAt}`);
    return revision;

  } catch (error) {
    console.error(`❌ Failed to log revision:`, error);
    // Disengaja tidak ada throw di sini biar tetep lanjut meskipun logging gagal
    return null;
  }
};

/**
 * Get complete revision history for an overtime request
 * Returns all actions taken on the request in chronological order
 * 
 * @param {string} overtimeRequestId - ID of overtime request
 * @returns {Promise<Array>} Array of revision records
 */
export const getRevisionHistory = async (overtimeRequestId) => {
  try {
    const revisions = await prisma.overtimeRevision.findMany({
      where: { overtimeRequestId },
      include: {
        reviser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true,
                level: true
              }
            },
            division: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`[Revision] Retrieved ${revisions.length} history entries for overtime ${overtimeRequestId}`);
    return revisions;

  } catch (error) {
    console.error(`❌ Failed to fetch revision history:`, error);
    return [];
  }
};

/**
 * Log overtime submission
 */
export const logSubmission = async (overtimeRequestId, employeeId, data) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: employeeId,
    action: REVISION_ACTIONS.SUBMITTED,
    changes: {
      totalHours: data.totalHours,
      totalAmount: data.totalAmount,
      entriesCount: data.entries?.length || 0,
      entries: data.entries
    },
    comment: 'Overtime request submitted'
  });
};

/**
 * Log overtime edit
 */
export const logEdit = async (overtimeRequestId, employeeId, beforeData, afterData) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: employeeId,
    action: REVISION_ACTIONS.EDITED,
    changes: {
      before: {
        totalHours: beforeData.totalHours,
        totalAmount: beforeData.totalAmount,
        entriesCount: beforeData.entries?.length || 0
      },
      after: {
        totalHours: afterData.totalHours,
        totalAmount: afterData.totalAmount,
        entriesCount: afterData.entries?.length || 0
      }
    },
    comment: 'Overtime request edited by employee'
  });
};

/**
 * Log supervisor approval
 */
export const logSupervisorApproval = async (overtimeRequestId, supervisorId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: supervisorId,
    action: REVISION_ACTIONS.APPROVED_SUPERVISOR,
    changes: {
      approvedBy: 'supervisor',
      previousStatus: 'PENDING'
    },
    comment: comment || 'Approved by supervisor'
  });
};

/**
 * Log supervisor rejection
 */
export const logSupervisorRejection = async (overtimeRequestId, supervisorId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: supervisorId,
    action: REVISION_ACTIONS.REJECTED_SUPERVISOR,
    changes: {
      rejectedBy: 'supervisor',
      previousStatus: 'PENDING'
    },
    comment: comment || 'Rejected by supervisor'
  });
};

/**
 * Log division head approval
 */
export const logDivisionHeadApproval = async (overtimeRequestId, divisionHeadId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: divisionHeadId,
    action: REVISION_ACTIONS.APPROVED_DIVHEAD,
    changes: {
      approvedBy: 'divisionHead',
      previousStatus: 'PENDING'
    },
    comment: comment || 'Approved by division head'
  });
};

/**
 * Log division head rejection
 */
export const logDivisionHeadRejection = async (overtimeRequestId, divisionHeadId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: divisionHeadId,
    action: REVISION_ACTIONS.REJECTED_DIVHEAD,
    changes: {
      rejectedBy: 'divisionHead',
      previousStatus: 'PENDING'
    },
    comment: comment || 'Rejected by division head'
  });
};

/**
 * Log revision request
 * CRITICAL: This preserves the revision request in history
 */
export const logRevisionRequest = async (overtimeRequestId, approverId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: approverId,
    action: REVISION_ACTIONS.REVISION_REQUESTED,
    changes: {
      previousStatus: 'PENDING',
      newStatus: 'REVISION_REQUESTED'
    },
    comment: comment || 'Revision requested'
  });
};

/**
 * Log admin override rejection
 * CRITICAL: This preserves the original approval data before override
 */
export const logAdminRejection = async (overtimeRequestId, adminId, comment, originalData) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: adminId,
    action: REVISION_ACTIONS.ADMIN_REJECTED,
    changes: {
      previousStatus: 'APPROVED',
      newStatus: 'REJECTED',
      originalSupervisorComment: originalData.supervisorComment,
      originalApprovedAt: originalData.approvedAt,
      originalApprover: originalData.finalApproverId,
      hoursDeducted: originalData.totalHours
    },
    comment: comment
  });
};

/**
 * Log final approval
 */
export const logFinalApproval = async (overtimeRequestId, approverId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: approverId,
    action: REVISION_ACTIONS.FINAL_APPROVED,
    changes: {
      finalStatus: 'APPROVED'
    },
    comment: comment || 'Finally approved'
  });
};

/**
 * Log final rejection
 */
export const logFinalRejection = async (overtimeRequestId, approverId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: approverId,
    action: REVISION_ACTIONS.FINAL_REJECTED,
    changes: {
      finalStatus: 'REJECTED'
    },
    comment: comment || 'Finally rejected'
  });
};

/**
 * Log deletion
 */
export const logDeletion = async (overtimeRequestId, userId, reason) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: userId,
    action: REVISION_ACTIONS.DELETED,
    changes: {
      deletedAt: new Date()
    },
    comment: reason || 'Overtime request deleted'
  });
};

/**
 * Log plan submission (pre-mode flow2a)
 */
export const logPlanSubmission = async (overtimeRequestId, employeeId, data) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: employeeId,
    action: REVISION_ACTIONS.PLAN_SUBMITTED,
    changes: {
      totalHours: data.totalHours,
      totalAmount: data.totalAmount,
      entriesCount: data.entries?.length || 0,
      entries: data.entries
    },
    comment: 'Overtime plan submitted — awaiting supervisor approval'
  });
};

/**
 * Log plan approved by supervisor (pre-mode)
 */
export const logPlanApprovalBySupervisor = async (overtimeRequestId, supervisorId, comment) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: supervisorId,
    action: REVISION_ACTIONS.PLAN_APPROVED_SPV,
    changes: {
      approvedBy: 'supervisor',
      previousStatus: 'PLAN_PENDING',
      newStatus: 'PLAN_APPROVED'
    },
    comment: comment || 'Overtime plan approved by supervisor'
  });
};

/**
 * Log moved to actualization queue (by scheduler)
 */
export const logMovedToActualization = async (overtimeRequestId, employeeId) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: employeeId,
    action: REVISION_ACTIONS.MOVED_TO_ACTUALIZATION,
    changes: {
      previousStatus: 'PLAN_APPROVED',
      newStatus: 'PENDING_ACTUALIZATION'
    },
    comment: 'All overtime dates have passed — employee notified to submit actual hours'
  });
};

/**
 * Log actualization (employee submits actual hours)
 */
export const logActualization = async (overtimeRequestId, employeeId, data) => {
  return logRevision({
    overtimeRequestId,
    revisedBy: employeeId,
    action: REVISION_ACTIONS.ACTUALIZED,
    changes: {
      plannedHours: data.plannedHours,
      actualHours: data.actualHours,
      exceedsPlanned: data.exceedsPlanned,
      newStatus: data.newStatus,
      entries: data.entries
    },
    comment: data.exceedsPlanned
      ? `Actual hours (${data.actualHours}h) exceed plan (${data.plannedHours}h) — sent back to supervisor`
      : `Actual hours submitted (${data.actualHours}h) — auto-approved`
  });
};

/**
 * Deduct overtime balance when admin rejects approved overtime
 * @param {string} employeeId - Employee ID
 * @param {number} hours - Number of hours to deduct
 */
export const deductOvertimeBalance = async (employeeId, hours) => {
  try {
    console.log(`[Deduct Balance] Deducting ${hours} hours for employee ${employeeId}`);

    // Find overtime balance
    let balance = await prisma.overtimeBalance.findUnique({
      where: { employeeId }
    });

    if (!balance) {
      console.warn(`[Deduct Balance] No balance found for employee ${employeeId}`);
      // Create a balance record with negative hours (this shouldn't happen but handle it)
      balance = await prisma.overtimeBalance.create({
        data: {
          employeeId,
          currentBalance: -hours, // Negative balance
          pendingHours: 0,
          totalPaid: 0
        }
      });
      console.log(`⚠️ Created new balance record with -${hours} hours`);
      return balance;
    }

    // Calculate new balance
    const newBalance = Math.max(0, balance.currentBalance - hours);
    
    console.log(`[Deduct Balance] Current: ${balance.currentBalance} hours`);
    console.log(`[Deduct Balance] Deducting: ${hours} hours`);
    console.log(`[Deduct Balance] New balance: ${newBalance} hours`);

    // Update balance
    const updatedBalance = await prisma.overtimeBalance.update({
      where: { employeeId },
      data: {
        currentBalance: newBalance
      }
    });

    console.log(`✅ Balance deducted successfully`);
    return updatedBalance;

  } catch (error) {
    console.error('[Deduct Balance] Error:', error);
    throw new Error(`Failed to deduct overtime balance: ${error.message}`);
  }
};

// Export all functions
export default {
  REVISION_ACTIONS,
  logRevision,
  getRevisionHistory,
  logSubmission,
  logPlanSubmission,
  logEdit,
  logSupervisorApproval,
  logSupervisorRejection,
  logPlanApprovalBySupervisor,
  logDivisionHeadApproval,
  logDivisionHeadRejection,
  logRevisionRequest,
  logAdminRejection,
  logFinalApproval,
  logFinalRejection,
  logMovedToActualization,
  logActualization,
  logDeletion,
  deductOvertimeBalance
};