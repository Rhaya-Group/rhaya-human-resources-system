// frontend/src/pages/OvertimeDetail.jsx
// MOBILE-RESPONSIVE VERSION - Card layout, collapsible sections, touch-friendly

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOvertimeRequestById } from "../api/client";
import { format } from "date-fns";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import {
  FileText, // For submitted
  Clock, // For pending
  CheckCircle, // For approved
  XCircle, // For rejected
  Ban, // For admin rejection
  Edit3, // For revision
  User,
  ArrowLeft,
  CalendarClock, // For plan submitted / moved to actualization
  ClipboardCheck, // For plan approved
  Zap, // For actualized
} from "lucide-react";

export default function OvertimeDetail() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [showAdminRejectModal, setShowAdminRejectModal] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [showAdminEditModal, setShowAdminEditModal] = useState(false);
  const [editEntries, setEditEntries] = useState([]);
  const [editReason, setEditReason] = useState("");
  const [editing, setEditing] = useState(false);

  const isAdmin = user?.accessLevel <= 2;

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const timelineEvents = useMemo(() => {
    if (!request || !request.revisions) return [];

    // Build timeline inline (no separate function needed)
    const events = [];

    if (request.revisions && request.revisions.length > 0) {
      request.revisions.forEach((revision) => {
        // Event config
        const eventMap = {
          SUBMITTED: {
            label: "Request Submitted",
            icon: FileText,
            color: "blue",
          },
          PLAN_SUBMITTED: {
            label: "Overtime Plan Submitted",
            icon: CalendarClock,
            color: "blue",
          },
          EDITED: {
            label: "Request Edited",
            icon: Edit3,
            color: "blue",
            showChanges: true,
          },
          APPROVED_SUPERVISOR: {
            label: "Approved by Supervisor",
            icon: CheckCircle,
            color: "green",
          },
          REJECTED_SUPERVISOR: {
            label: "Rejected by Supervisor",
            icon: XCircle,
            color: "red",
          },
          PLAN_APPROVED_SPV: {
            label: "Overtime Plan Approved by Supervisor",
            icon: ClipboardCheck,
            color: "teal",
          },
          APPROVED_DIVHEAD: {
            label: "Approved by Division Head",
            icon: CheckCircle,
            color: "green",
          },
          REJECTED_DIVHEAD: {
            label: "Rejected by Division Head",
            icon: XCircle,
            color: "red",
          },
          REVISION_REQUESTED: {
            label: "Revision Requested",
            icon: Edit3,
            color: "orange",
          },
          ADMIN_REJECTED: {
            label: "Rejected by HR Admin (Override)",
            icon: Ban,
            color: "gray",
            showOriginalData: true,
          },
          ADMIN_EDITED_APPROVED: {
            label: "Edited by HR Admin (Approved)",
            icon: Edit3,
            color: "blue",
            showChanges: true,
          },
          ADMIN_EDITED_REJECTED: {
            label: "Edited by HR Admin (Resubmitted)",
            icon: Edit3,
            color: "orange",
            showChanges: true,
          },
          FINAL_APPROVED: {
            label: "Finally Approved",
            icon: CheckCircle,
            color: "green",
          },
          FINAL_REJECTED: {
            label: "Finally Rejected",
            icon: XCircle,
            color: "red",
          },
          MOVED_TO_ACTUALIZATION: {
            label: "Overtime Date Passed — Actualization Required",
            icon: CalendarClock,
            color: "purple",
          },
          ACTUALIZED: {
            label: "Actual Hours Submitted",
            icon: Zap,
            color: "purple",
            showChanges: true,
          },
          DELETED: { label: "Request Deleted", icon: XCircle, color: "gray" },
        };

        const config = eventMap[revision.action];
        if (config) {
          events.push({
            type: revision.action,
            label: config.label,
            actor: revision.reviser?.name || "System",
            actorRole: revision.reviser?.role?.name,
            date: revision.createdAt,
            comment: revision.comment,
            changes: revision.changes,
            icon: config.icon,
            color: config.color,
            showChanges: config.showChanges,
            showOriginalData: config.showOriginalData,
          });
        }
      });
    }

    return events;
  }, [request]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequestById(requestId);
      setRequest(data);
      if (data && user?.id) {
        const ownershipResult = user.employeeId === data.employee?.employeeId;
        setIsOwner(ownershipResult);

        // Optional: Debug log
        console.log("Ownership check:", {
          userEmployeeId: user.employeeId,
          requestEmployeeId: data.employee?.id,
          isOwner: ownershipResult,
          userName: user.name,
          requestEmployeeName: data.employee?.name,
        });
      } else {
        setIsOwner(false);
      }
      setError("");
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.error || t("overtime.failedToLoad"));
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  // Status badge - Mobile Optimized
  const StatusBadge = ({ status }) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      APPROVED: "bg-green-100 text-green-800 border-green-200",
      REJECTED: "bg-red-100 text-red-800 border-red-200",
      REVISION_REQUESTED: "bg-orange-100 text-orange-800 border-orange-200",
    };

    const labels = {
      PENDING: t("overtime.pendingApproval"),
      APPROVED: t("overtime.approved"),
      REJECTED: t("overtime.rejected"),
      REVISION_REQUESTED: t("overtime.revisionRequested"),
    };

    const icons = {
      PENDING: (
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      ),
      APPROVED: (
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
      REJECTED: (
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
      REVISION_REQUESTED: (
        <svg
          className="w-4 h-4 sm:w-5 sm:h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    };

    return (
      <div
        className={`inline-flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border-2 ${styles[status]}`}
      >
        {icons[status]}
        <span className="text-xs sm:text-sm font-semibold">
          {labels[status]}
        </span>
      </div>
    );
  };

  const handleAdminReject = async () => {
    if (adminComment.trim().length < 20) {
      alert("Rejection reason must be at least 20 characters");
      return;
    }
    if (!confirmReject) {
      alert("Please confirm the rejection");
      return;
    }
    try {
      setRejecting(true);
      const response = await apiClient.post(
        `/overtime/${requestId}/admin-reject`,
        {
          comment: adminComment.trim(),
        },
      );
      if (response.data.success) {
        alert("Overtime rejected successfully. Balance has been deducted.");
        setShowAdminRejectModal(false);
        await fetchRequest(); // Refresh to show updated status
      }
    } catch (error) {
      console.error("Admin reject error:", error);
      const errorMsg =
        error.response?.data?.error || "Failed to reject overtime";
      alert(errorMsg);
    } finally {
      setRejecting(false);
    }
  };

  const handleAdminEdit = async () => {
    if (editReason.trim().length < 20) {
      alert("Edit reason must be at least 20 characters");
      return;
    }

    // Validate entries
    for (const entry of editEntries) {
      if (!entry.date || !entry.hours || !entry.description) {
        alert("All entries must have date, hours, and description");
        return;
      }
      if (entry.hours <= 0 || entry.hours > 12) {
        alert(
          `Invalid hours for ${entry.date}. Must be between 0.5 and 12 hours`,
        );
        return;
      }
    }

    try {
      setEditing(true);

      const response = await apiClient.put(
        `/overtime/${requestId}/admin-edit`,
        {
          entries: editEntries.map((e) => ({
            date: e.date,
            hours: parseFloat(e.hours),
            description: e.description,
          })),
          reason: editReason.trim(),
        },
      );

      if (response.data.success) {
        const statusChange =
          request.status === "REJECTED"
            ? " Status changed to PENDING for reapproval."
            : "";
        alert(`Overtime edited successfully!${statusChange}`);
        setShowAdminEditModal(false);
        await fetchRequest(); // Refresh
      }
    } catch (error) {
      console.error("Admin edit error:", error);
      const errorMsg = error.response?.data?.error || "Failed to edit overtime";
      alert(errorMsg);
    } finally {
      setEditing(false);
    }
  };

  const openAdminEditModal = () => {
    // Initialize edit entries from current request
    const entries = request.entries.map((entry) => ({
      date: format(new Date(entry.date), "yyyy-MM-dd"),
      hours: entry.hours.toString(),
      description: entry.description,
    }));
    setEditEntries(entries);
    setEditReason("");
    setShowAdminEditModal(true);
  };

  const addEditEntry = () => {
    setEditEntries([...editEntries, { date: "", hours: "", description: "" }]);
  };

  const removeEditEntry = (index) => {
    if (editEntries.length === 1) {
      alert("At least one entry is required");
      return;
    }
    setEditEntries(editEntries.filter((_, i) => i !== index));
  };

  const updateEditEntry = (index, field, value) => {
    const newEntries = [...editEntries];
    newEntries[index][field] = value;
    setEditEntries(newEntries);
  };

  const calculateEditTotal = () => {
    return editEntries.reduce((sum, entry) => {
      const hours = parseFloat(entry.hours) || 0;
      return sum + hours;
    }, 0);
  };

  const TimelineEvent = ({ event, isLast }) => {
    const [showChanges, setShowChanges] = useState(false);

    const colorClasses = {
      blue: {
        dot: "bg-blue-500",
        bg: "bg-blue-50/50",
        border: "border-blue-100",
        text: "text-blue-600",
        textDark: "text-blue-900",
      },
      green: {
        dot: "bg-green-500",
        bg: "bg-green-50/50",
        border: "border-green-100",
        text: "text-green-600",
        textDark: "text-green-900",
      },
      red: {
        dot: "bg-red-500",
        bg: "bg-red-50/50",
        border: "border-red-100",
        text: "text-red-600",
        textDark: "text-red-900",
      },
      orange: {
        dot: "bg-orange-500",
        bg: "bg-orange-50/50",
        border: "border-orange-100",
        text: "text-orange-600",
        textDark: "text-orange-900",
      },
      gray: {
        dot: "bg-gray-500",
        bg: "bg-gray-50/50",
        border: "border-gray-200",
        text: "text-gray-600",
        textDark: "text-gray-900",
      },
      teal: {
        dot: "bg-teal-500",
        bg: "bg-teal-50/50",
        border: "border-teal-100",
        text: "text-teal-600",
        textDark: "text-teal-900",
      },
      purple: {
        dot: "bg-purple-500",
        bg: "bg-purple-50/50",
        border: "border-purple-100",
        text: "text-purple-600",
        textDark: "text-purple-900",
      },
    };

    const colors = colorClasses[event.color] || colorClasses.gray;
    const Icon = event.icon;

    return (
      <div className="relative">
        {/* Timeline dot */}
        <div
          className={`absolute -left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${colors.dot}`}
        />

        {/* Vertical line connector */}
        {!isLast && (
          <div
            className="absolute left-[-25px] top-[22px] w-0.5 bg-gray-200"
            style={{ height: "calc(100% + 10px)" }}
          />
        )}

        {/* Event card */}
        <div className={`${colors.bg} rounded-2xl border ${colors.border} p-4`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-3 flex-1">
              <Icon size={18} className={colors.text} />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[10px] font-bold ${colors.text} uppercase tracking-tight`}
                >
                  {event.label}
                </p>
                <p className={`text-sm font-bold ${colors.textDark} truncate`}>
                  {event.actor}
                </p>
                {/* ✅ CORRECTED: Show role name from role.name */}
                {event.actorRole && (
                  <p className="text-[10px] text-gray-500">{event.actorRole}</p>
                )}
              </div>
            </div>
            {event.date && (
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter flex-shrink-0 ml-2">
                {format(new Date(event.date), "MMM dd • HH:mm")}
              </p>
            )}
          </div>

          {/* Comment if exists */}
          {event.comment && (
            <div className="mt-3 bg-white/50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-600 italic leading-relaxed">
                "{event.comment}"
              </p>
            </div>
          )}

          {/* Show changes for EDITED action */}
          {event.type === "EDITED" && event.changes && (
            <div className="mt-3">
              <button
                onClick={() => setShowChanges(!showChanges)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {showChanges ? "Hide Changes" : "View Changes"}
              </button>

              {showChanges && (
                <div className="mt-2 bg-white/70 rounded-lg p-3 border border-gray-200 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-bold text-red-600 mb-1">Before:</p>
                      <p>Hours: {event.changes.before?.totalHours || 0}</p>
                      <p>
                        Amount: Rp{" "}
                        {event.changes.before?.totalAmount?.toLocaleString(
                          "id-ID",
                        ) || 0}
                      </p>
                      <p>
                        Entries:{" "}
                        {event.changes.before?.entriesCount ||
                          event.changes.before?.entries?.length ||
                          0}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-green-600 mb-1">After:</p>
                      <p>Hours: {event.changes.after?.totalHours || 0}</p>
                      <p>
                        Amount: Rp{" "}
                        {event.changes.after?.totalAmount?.toLocaleString(
                          "id-ID",
                        ) || 0}
                      </p>
                      <p>
                        Entries:{" "}
                        {event.changes.after?.entriesCount ||
                          event.changes.after?.entries?.length ||
                          0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show actual vs planned for ACTUALIZED */}
          {event.type === "ACTUALIZED" && event.changes && (
            <div className="mt-3 bg-white/70 rounded-lg p-3 border border-purple-200 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-bold text-gray-500 mb-1">Planned:</p>
                  <p className="text-gray-700">{event.changes.plannedHours}h</p>
                </div>
                <div>
                  <p className={`font-bold mb-1 ${event.changes.exceedsPlanned ? "text-orange-600" : "text-green-600"}`}>
                    Actual:
                  </p>
                  <p className={event.changes.exceedsPlanned ? "text-orange-700" : "text-green-700"}>
                    {event.changes.actualHours}h
                    {event.changes.exceedsPlanned && " ⚠ exceeds plan"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-gray-500">
                Result: <span className="font-semibold">
                  {event.changes.newStatus === "APPROVED"
                    ? "Auto-approved"
                    : "Sent back to supervisor for re-approval"}
                </span>
              </p>
            </div>
          )}

          {/* Show original data for admin rejection */}
          {event.type === "ADMIN_REJECTED" &&
            event.changes?.originalSupervisorComment && (
              <div className="mt-3 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <p className="text-[10px] font-bold text-yellow-800 uppercase mb-1">
                  Original Approval (Overridden):
                </p>
                <p className="text-xs text-yellow-700 italic">
                  "{event.changes.originalSupervisorComment}"
                </p>
                <p className="text-[10px] text-yellow-600 mt-1">
                  Originally approved:{" "}
                  {event.changes.originalApprovedAt
                    ? format(
                        new Date(event.changes.originalApprovedAt),
                        "MMM dd, yyyy • HH:mm",
                      )
                    : "N/A"}
                </p>
              </div>
            )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-4 text-sm text-gray-600">
            {t("overtime.loadingRequest")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-red-900">
                {t("overtime.errorLoadingRequest")}
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              {t("overtime.backToHistory")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft size={14} className="mr-1" /> {t("common.back")}
        </button>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
          {t("overtime.detailTitle")}
        </h1>
      </div>

      {/* Status & Actions - Mobile: Stack, Desktop: Row */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StatusBadge status={request.status} />
        {isOwner &&
          (request.status === "PENDING" ||
            request.status === "REVISION_REQUESTED") && (
            <Link
              to={`/overtime/edit/${request.id}`}
              className="inline-flex items-center justify-center px-4 py-2.5 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            >
              {t("overtime.editRequest")}
            </Link>
          )}
      </div>

      {/* Main Content */}
      <div className="space-y-4 sm:space-y-6">
        {/* Employee Information - Clean Profile Style */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5">
            {/* Profile Header Row */}
            <div className="flex items-center space-x-4 pb-5 border-b border-gray-50 mb-5">
              <div className="h-12 w-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center border border-gray-200 flex-shrink-0">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mb-1">
                  {t("overtime.employeeInformation")}
                </p>
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {request.employee.name}
                </h2>
              </div>
            </div>

            {/* Info Grid - 2 columns even on mobile to save space */}
            <dl className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  {t("overtime.employeeId")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-gray-700">
                  {request.employee.nip || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  {t("overtime.role")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-gray-700 truncate">
                  {request.employee.role?.name || "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  {t("overtime.division")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-gray-700">
                  {request.employee.division?.name || "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header: Slimmer & Text-only */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              {t("overtime.requestSummary")}
            </h2>
          </div>

          <div className="p-5">
            {/* Summary Grid: No backgrounds, just clean typography */}
            <div className="flex justify-between items-end pb-6 border-b border-gray-50">
              <div>
                <p className="text-[10px] uppercase tracking-bold text-gray-400 font-bold">
                  {t("overtime.totalHours")}
                </p>
                <p className="text-2xl font-black text-gray-900 leading-none mt-1">
                  {request.totalHours}
                  <span className="text-xs ml-1 font-medium text-gray-400">
                    hrs
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-bold text-gray-400 font-bold">
                  {t("overtime.estimatedAmount")}
                </p>
                <p className="text-xl font-bold text-green-600 leading-none mt-1">
                  Rp {request.totalAmount.toLocaleString("id-ID")}
                </p>
              </div>
            </div>

            {/* Individual Entries - Clean Timeline Style */}
            <div className="mt-6">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                {t("overtime.detailedBreakdown")}
              </h3>

              <div className="space-y-8 relative">
                {/* Vertical Line Connector */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-100" />

                {request.entries.map((entry, index) => (
                  <div key={entry.id} className="relative pl-8">
                    {/* Dot on the timeline */}
                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-blue-500 shadow-sm" />

                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900 leading-none">
                          {format(new Date(entry.date), "EEEE, MMM dd")}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.hours}h
                      </span>
                    </div>

                    {/* Description Area */}
                    <div className="bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-1 tracking-tight">
                        {t("overtime.description")}
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Current Approver - Subtle Callout */}
          {/* Request Timeline - Complete History */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {t("overtime.approvalInformation")}
              </h2>
            </div>

            <div className="p-5">
              {/* Supervisor Info (if exists) */}
              {request.supervisor && (
                <div className="flex items-center space-x-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 mb-6">
                  <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-gray-400 border border-gray-100">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                      {t("overtime.supervisor")}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {request.supervisor.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative pl-8">
                <div className="space-y-8">
                  {/* Build timeline events dynamically */}
                  {timelineEvents.map((event, index) => (
                    <TimelineEvent
                      key={index}
                      event={event}
                      isLast={index === timelineEvents.length - 1}
                    />
                  ))}

                  {/* Pending status - show current approver */}
                  {request.status === "PENDING" && (
                    <div className="relative">
                      <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 bg-orange-400 animate-pulse" />
                      <div className="bg-orange-50/50 rounded-2xl border border-orange-100 p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <Clock size={18} className="text-orange-600" />
                          <div>
                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-tight">
                              Pending Approval
                            </p>
                            <p className="text-sm font-bold text-orange-900">
                              {request.currentApprover?.name ||
                                "Awaiting Approver"}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-orange-700 mt-2">
                          Waiting for approval decision
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isAdmin && request.status === "APPROVED" && !request.isRecapped && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start space-x-3 mb-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800">Admin Override</h4>
              <p className="text-xs text-red-700 mt-1">
                As HR Admin, you can reject this approved overtime if there are
                issues with the approval.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAdminRejectModal(true)}
            className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm transition-colors flex items-center justify-center space-x-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Admin Reject Overtime</span>
          </button>
        </div>
      )}
      {isAdmin &&
        (request.status === "APPROVED" || request.status === "REJECTED") &&
        !request.isRecapped && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start space-x-3 mb-3">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path
                  fillRule="evenodd"
                  d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-800">Admin Edit</h4>
                <p className="text-xs text-blue-700 mt-1">
                  {request.status === "APPROVED"
                    ? "Edit this approved overtime. Balance will be automatically adjusted."
                    : "Edit and resubmit this rejected overtime for approval."}
                </p>
              </div>
            </div>
            <button
              onClick={openAdminEditModal}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors flex items-center justify-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Edit Overtime</span>
            </button>
          </div>
        )}
      {/* Admin Reject Modal */}
      {showAdminRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 mb-1">
                  Admin Reject Approved Overtime?
                </h3>
                <p className="text-sm text-gray-600">
                  This will override the supervisor's approval decision.
                </p>
              </div>
            </div>

            {/* Overtime Details Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                Overtime Details
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Employee:</span>
                  <span className="font-bold text-gray-900">
                    {request.employee?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hours:</span>
                  <span className="font-bold text-gray-900">
                    {request.totalHours} hours
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-bold text-gray-900">
                    Rp {request.totalAmount?.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-bold text-yellow-800 mb-2">
                ⚠️ What Will Happen:
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1.5 ml-4 list-disc">
                <li>
                  Status will change to <strong>REJECTED</strong>
                </li>
                <li>
                  Employee's overtime balance will be{" "}
                  <strong>deducted ({request.totalHours} hours)</strong>
                </li>
                <li>
                  Notifications will be sent to employee, supervisor, and HR
                </li>
                <li>This action will be logged in the system</li>
                <li>
                  This overtime <strong>will not</strong> be included in payroll
                </li>
              </ul>
            </div>

            {/* Rejection Reason */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                placeholder="Explain in detail why this approved overtime is being rejected..."
                disabled={rejecting}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Minimum 20 characters required
                </p>
                <p
                  className={`text-xs font-bold ${adminComment.length >= 20 ? "text-green-600" : "text-red-600"}`}
                >
                  {adminComment.length}/20
                </p>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmReject}
                  onChange={(e) => setConfirmReject(e.target.checked)}
                  disabled={rejecting}
                  className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  I confirm that this overtime rejection is necessary and I
                  understand the consequences.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdminRejectModal(false);
                  setAdminComment("");
                  setConfirmReject(false);
                }}
                disabled={rejecting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminReject}
                disabled={
                  rejecting || adminComment.trim().length < 20 || !confirmReject
                }
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm disabled:opacity-50 flex items-center justify-center"
              >
                {rejecting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  "Confirm Rejection"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Modal */}
      {showAdminEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-900 mb-1">
                  Admin Edit Overtime
                </h3>
                <p className="text-sm text-gray-600">
                  {request.status === "APPROVED"
                    ? "Editing approved overtime. Balance will be automatically adjusted."
                    : "Editing rejected overtime. Status will change to PENDING for reapproval."}
                </p>
              </div>
              <button
                onClick={() => setShowAdminEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Current vs New Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                  Current
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {request.totalHours} hrs
                </p>
                <p className="text-sm text-gray-600">
                  Rp {request.totalAmount?.toLocaleString("id-ID")}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase mb-1">
                  New
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {calculateEditTotal()} hrs
                </p>
                <p className="text-sm text-blue-600">
                  {calculateEditTotal() > request.totalHours ? "+" : ""}
                  {(calculateEditTotal() - request.totalHours).toFixed(1)} hrs
                </p>
              </div>
            </div>

            {/* Entries Editor */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                Overtime Entries
              </h4>
              <div className="space-y-3">
                {editEntries.map((entry, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) =>
                          updateEditEntry(index, "date", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        disabled={editing}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Hours
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="12"
                        value={entry.hours}
                        onChange={(e) =>
                          updateEditEntry(index, "hours", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        disabled={editing}
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) =>
                          updateEditEntry(index, "description", e.target.value)
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        placeholder="Task description..."
                        disabled={editing}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() => removeEditEntry(index)}
                        disabled={editing || editEntries.length === 1}
                        className="w-full px-2 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                      >
                        <svg
                          className="w-4 h-4 mx-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addEditEntry}
                disabled={editing}
                className="mt-3 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 font-medium text-sm disabled:opacity-50"
              >
                + Add Entry
              </button>
            </div>

            {/* Edit Reason */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Edit Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Explain why you're editing this overtime (min 20 characters)..."
                disabled={editing}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Minimum 20 characters required
                </p>
                <p
                  className={`text-xs font-bold ${editReason.length >= 20 ? "text-green-600" : "text-red-600"}`}
                >
                  {editReason.length}/20
                </p>
              </div>
            </div>

            {/* Status Change Notice */}
            {request.status === "REJECTED" && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-bold text-yellow-800 mb-1">
                  ⚠️ Status Change
                </p>
                <p className="text-xs text-yellow-700">
                  This overtime will change from REJECTED to PENDING and will be
                  reassigned to the employee's current supervisor for
                  reapproval.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAdminEditModal(false)}
                disabled={editing}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminEdit}
                disabled={
                  editing ||
                  editReason.trim().length < 20 ||
                  calculateEditTotal() === 0
                }
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm disabled:opacity-50 flex items-center justify-center"
              >
                {editing ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
