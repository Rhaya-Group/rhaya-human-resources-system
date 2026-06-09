// frontend/src/pages/OvertimeApproval.jsx
// MOBILE-RESPONSIVE VERSION - Horizontal tabs, collapsible filters, responsive cards

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import { format } from "date-fns";

export default function OvertimeApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [comment, setComment] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [revisionCount, setRevisionCount] = useState(0);
  const [plannedCount, setPlannedCount] = useState(0);

  // ── V2: Fetch approver's entity policy to know if pre-mode ───────────────
  const [overtimeMode, setOvertimeMode] = useState("post"); // "pre" | "post"
  const isPreMode = overtimeMode === "pre";

  // Filter state
  const [filters, setFilters] = useState({
    divisionId: "",
    search: "",
    requestDateFrom: "",
    requestDateTo: "",
    overtimeDateFrom: "",
    overtimeDateTo: "",
    hoursMin: "",
    hoursMax: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = user?.accessLevel <= 2;

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    fetchDivisions();
    fetchOvertimePolicy();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, allRequests]);

  const fetchOvertimePolicy = async () => {
    try {
      const res = await apiClient.get("/policy-templates/my-policy-url");
      const mode = res.data.data?.overtimeMode || "post";
      setOvertimeMode(mode);
    } catch (err) {
      console.error("Failed to fetch overtime policy:", err);
    }
  };

  const fetchDivisions = async () => {
    try {
      const response = await apiClient.get("/divisions");
      setDivisions(response.data.data || []);
    } catch (error) {
      console.error("Fetch divisions error:", error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let data = [];

      if (isAdmin) {
        // ── Admin (Level 1-2): use admin endpoint, full visibility ───────────
        if (activeTab === "pending") {
          const [pendingRes, planRes] = await Promise.allSettled([
            apiClient.get("/overtime/admin/all-requests?status=PENDING"),
            apiClient.get("/overtime/admin/all-requests?status=PLAN_PENDING"),
          ]);
          const pending =
            pendingRes.status === "fulfilled"
              ? pendingRes.value.data.data || []
              : [];
          const planned =
            planRes.status === "fulfilled" ? planRes.value.data.data || [] : [];
          const seen = new Set();
          data = [...pending, ...planned].filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setPendingCount(data.length);
        } else if (activeTab === "planned") {
          // Planned tab: PLAN_PENDING + PLAN_APPROVED
          const [planPendingRes, planApprovedRes] = await Promise.allSettled([
            apiClient.get("/overtime/admin/all-requests?status=PLAN_PENDING"),
            apiClient.get("/overtime/admin/all-requests?status=PLAN_APPROVED"),
          ]);
          const planPending =
            planPendingRes.status === "fulfilled"
              ? planPendingRes.value.data.data || []
              : [];
          const planApproved =
            planApprovedRes.status === "fulfilled"
              ? planApprovedRes.value.data.data || []
              : [];
          const seen = new Set();
          data = [...planPending, ...planApproved].filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setPlannedCount(data.length);
        } else if (activeTab === "revision") {
          const res = await apiClient.get(
            "/overtime/admin/all-requests?status=REVISION_REQUESTED",
          );
          data = res.data.data || [];
          setRevisionCount(data.length);
        } else if (activeTab === "all") {
          const res = await apiClient.get("/overtime/admin/all-requests");
          data = res.data.data || [];
          const count = data.filter(
            (r) => r.status === "PENDING" || r.status === "PLAN_PENDING",
          ).length;
          setPendingCount(count);
          const pCount = data.filter(
            (r) => r.status === "PLAN_PENDING" || r.status === "PLAN_APPROVED",
          ).length;
          setPlannedCount(pCount);
        } else {
          // approved / rejected
          const res = await apiClient.get(
            `/overtime/admin/all-requests?status=${activeTab.toUpperCase()}`,
          );
          data = res.data.data || [];
        }
      } else {
        // ── SPV / non-admin (Level 3+) ────────────────────────────────────────
        if (activeTab === "pending") {
          const [pendingRes, planRes] = await Promise.allSettled([
            apiClient.get("/overtime/pending-approval/list?status=PENDING"),
            apiClient.get(
              "/overtime/pending-approval/list?status=PLAN_PENDING",
            ),
          ]);
          const pending =
            pendingRes.status === "fulfilled"
              ? pendingRes.value.data.data || []
              : [];
          const planned =
            planRes.status === "fulfilled" ? planRes.value.data.data || [] : [];
          const seen = new Set();
          data = [...pending, ...planned].filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setPendingCount(data.length);
        } else if (activeTab === "planned") {
          // Planned tab: PLAN_PENDING + PLAN_APPROVED assigned to this SPV
          const [planPendingRes, planApprovedRes] = await Promise.allSettled([
            apiClient.get(
              "/overtime/pending-approval/list?status=PLAN_PENDING",
            ),
            apiClient.get(
              "/overtime/pending-approval/list?status=PLAN_APPROVED",
            ),
          ]);
          const planPending =
            planPendingRes.status === "fulfilled"
              ? planPendingRes.value.data.data || []
              : [];
          const planApproved =
            planApprovedRes.status === "fulfilled"
              ? planApprovedRes.value.data.data || []
              : [];
          const seen = new Set();
          data = [...planPending, ...planApproved].filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
          setPlannedCount(data.length);
        } else if (activeTab === "revision") {
          const res = await apiClient.get(
            "/overtime/pending-approval/list?status=REVISION_REQUESTED",
          );
          data = res.data.data || [];
          setRevisionCount(data.length);
        } else if (activeTab === "approved") {
          const res = await apiClient.get(
            "/overtime/pending-approval/list?status=APPROVED",
          );
          data = res.data.data || [];
        } else if (activeTab === "rejected") {
          const res = await apiClient.get(
            "/overtime/pending-approval/list?status=REJECTED",
          );
          data = res.data.data || [];
        } else {
          // all tab — fetch all relevant statuses
          const statuses = [
            "PENDING",
            "PLAN_PENDING",
            "PLAN_APPROVED",
            "REVISION_REQUESTED",
            "APPROVED",
            "REJECTED",
          ];
          const results = await Promise.allSettled(
            statuses.map((s) =>
              apiClient.get(`/overtime/pending-approval/list?status=${s}`),
            ),
          );
          const seen = new Set();
          data = results
            .filter((r) => r.status === "fulfilled")
            .flatMap((r) => r.value.data.data || [])
            .filter((r) => {
              if (seen.has(r.id)) return false;
              seen.add(r.id);
              return true;
            });
          const count = data.filter(
            (r) => r.status === "PENDING" || r.status === "PLAN_PENDING",
          ).length;
          setPendingCount(count);
          const pCount = data.filter(
            (r) => r.status === "PLAN_PENDING" || r.status === "PLAN_APPROVED",
          ).length;
          setPlannedCount(pCount);
        }
      }

      setAllRequests(data);
      setRequests(data);
    } catch (error) {
      console.error("Fetch error:", error);
      alert(t("overtime.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allRequests];

    if (filters.divisionId) {
      filtered = filtered.filter(
        (req) => req.employee?.divisionId === filters.divisionId,
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.employee?.name?.toLowerCase().includes(searchLower) ||
          req.employee?.nip?.toLowerCase().includes(searchLower),
      );
    }

    if (filters.requestDateFrom) {
      filtered = filtered.filter(
        (req) => new Date(req.submittedAt) >= new Date(filters.requestDateFrom),
      );
    }
    if (filters.requestDateTo) {
      filtered = filtered.filter(
        (req) =>
          new Date(req.submittedAt) <=
          new Date(filters.requestDateTo + "T23:59:59"),
      );
    }

    if (filters.overtimeDateFrom || filters.overtimeDateTo) {
      filtered = filtered.filter((req) => {
        return req.entries.some((entry) => {
          const entryDate = new Date(entry.date);
          const matchFrom =
            !filters.overtimeDateFrom ||
            entryDate >= new Date(filters.overtimeDateFrom);
          const matchTo =
            !filters.overtimeDateTo ||
            entryDate <= new Date(filters.overtimeDateTo);
          return matchFrom && matchTo;
        });
      });
    }

    if (filters.hoursMin) {
      filtered = filtered.filter(
        (req) => req.totalHours >= parseFloat(filters.hoursMin),
      );
    }
    if (filters.hoursMax) {
      filtered = filtered.filter(
        (req) => req.totalHours <= parseFloat(filters.hoursMax),
      );
    }

    setRequests(filtered);
  };

  const clearFilters = () => {
    setFilters({
      divisionId: "",
      search: "",
      requestDateFrom: "",
      requestDateTo: "",
      overtimeDateFrom: "",
      overtimeDateTo: "",
      hoursMin: "",
      hoursMax: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  const handleAction = async () => {
    if (
      (actionType === "reject" || actionType === "revision") &&
      !comment.trim()
    ) {
      alert(t("overtime.commentRequired"));
      return;
    }

    setLoading(true);
    try {
      const endpointMap = {
        approve: "approve",
        "approve-plan": "approve-plan", // ✅ V2: plan approval
        reject: "reject",
        revision: "request-revision",
      };

      await apiClient.post(
        `/overtime/${selectedRequest.id}/${endpointMap[actionType]}`,
        { comment: comment || null },
      );

      alert(t("overtime.actionSuccess"));
      setShowModal(false);
      setSelectedRequest(null);
      setComment("");
      fetchRequests();
    } catch (error) {
      console.error("Action error:", error);
      alert(error.response?.data?.error || t("overtime.actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setComment("");
    setShowModal(true);
  };

  const getStatusBadge = (status, isIncidental) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      REVISION_REQUESTED: "bg-orange-100 text-orange-800",
      PLAN_PENDING: "bg-blue-100 text-blue-800",
      PLAN_APPROVED: "bg-teal-100 text-teal-800",
      PENDING_ACTUALIZATION: "bg-purple-100 text-purple-800",
    };
    const labels = {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      REVISION_REQUESTED: "Revision Requested",
      PLAN_PENDING: "Plan Pending",
      PLAN_APPROVED: "Plan Approved",
      PENDING_ACTUALIZATION: "Needs Actualization",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
      >
        {labels[status] || status.replace(/_/g, " ")}
        {/* {isIncidental && (
          <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full font-semibold">
            insidentil
          </span>
        )}*/}
      </span>
    );
  };

  const truncateText = (text, maxLength = 80) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {t("overtime.approvalTitle")}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {t("overtime.viewManageRequests")}
        </p>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tabs - Mobile: Horizontal Scroll, Desktop: Normal */}
        <div className="border-b border-gray-200">
          {/* Mobile: Horizontal scrollable tabs */}
          <nav
            className="flex sm:hidden overflow-x-auto scrollbar-hide px-2"
            aria-label="Tabs"
          >
            {[
              {
                key: "pending",
                label: t("overtime.pending"),
                color: "border-blue-500 text-blue-600",
                badge: pendingCount,
                badgeColor: "bg-red-500",
                show: true,
              },
              {
                key: "planned",
                label: "Planned",
                color: "border-teal-500 text-teal-600",
                badge: plannedCount,
                badgeColor: "bg-teal-500",
                show: isPreMode,
              },
              {
                key: "revision",
                label: t("overtime.revision"),
                color: "border-orange-500 text-orange-600",
                badge: revisionCount,
                badgeColor: "bg-orange-500",
                show: true,
              },
              {
                key: "approved",
                label: t("overtime.approved"),
                color: "border-green-500 text-green-600",
                badge: 0,
                badgeColor: "",
                show: true,
              },
              {
                key: "rejected",
                label: t("overtime.rejected"),
                color: "border-red-500 text-red-600",
                badge: 0,
                badgeColor: "",
                show: true,
              },
              {
                key: "all",
                label: t("overtime.allRequests"),
                color: "border-gray-500 text-gray-700",
                badge: 0,
                badgeColor: "",
                show: true,
              },
            ]
              .filter((tab) => tab.show)
              .map(({ key, label, color, badge, badgeColor }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-shrink-0 py-3 px-3 border-b-2 font-medium text-xs whitespace-nowrap ${
                    activeTab === key
                      ? color
                      : "border-transparent text-gray-500"
                  }`}
                >
                  {label}
                  {badge > 0 && (
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 ${badgeColor} text-white text-xs rounded-full`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              ))}
          </nav>

          {/* Desktop: Normal flex tabs */}
          <nav
            className="hidden sm:flex space-x-6 px-6 overflow-x-auto"
            aria-label="Tabs"
          >
            {[
              {
                key: "pending",
                label: t("overtime.pending"),
                color: "border-blue-500 text-blue-600",
                badge: pendingCount,
                badgeColor: "bg-red-500",
                show: true,
              },
              {
                key: "planned",
                label: "Planned",
                color: "border-teal-500 text-teal-600",
                badge: plannedCount,
                badgeColor: "bg-teal-500",
                show: isPreMode,
              },
              {
                key: "revision",
                label: t("overtime.revision"),
                color: "border-orange-500 text-orange-600",
                badge: revisionCount,
                badgeColor: "bg-orange-500",
                show: true,
              },
              {
                key: "approved",
                label: t("overtime.approved"),
                color: "border-green-500 text-green-600",
                badge: 0,
                badgeColor: "",
                show: true,
              },
              {
                key: "rejected",
                label: t("overtime.rejected"),
                color: "border-red-500 text-red-600",
                badge: 0,
                badgeColor: "",
                show: true,
              },
              {
                key: "all",
                label: t("overtime.allRequests"),
                color: "border-gray-500 text-gray-700",
                badge: 0,
                badgeColor: "",
                show: true,
              },
            ]
              .filter((tab) => tab.show)
              .map(({ key, label, color, badge, badgeColor }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === key
                      ? color
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {label}
                  {badge > 0 && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 ${badgeColor} text-white text-xs rounded-full`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              ))}
          </nav>
        </div>

        {/* Filters Section - Mobile Optimized */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <svg
              className="w-5 h-5 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span className="truncate">
              {showFilters
                ? t("overtime.hideFilters")
                : t("overtime.showFilters")}
            </span>
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full flex-shrink-0">
                {Object.values(filters).filter((v) => v !== "").length}
              </span>
            )}
          </button>

          {showFilters && (
            <div className="mt-4 space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 lg:gap-6">
              {/* Division Filter */}
              <div className="border-l-4 border-blue-500 pl-3 sm:pl-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("overtime.division")}
                </label>
                <select
                  value={filters.divisionId}
                  onChange={(e) =>
                    setFilters({ ...filters, divisionId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("overtime.allDivisions")}</option>
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Filter */}
              <div className="border-l-4 border-green-500 pl-3 sm:pl-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("overtime.searchEmployee")}
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  placeholder={t("overtime.searchPlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Request Date Range */}
              <div className="border-l-4 border-yellow-500 pl-3 sm:pl-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {t("overtime.requestDateRange")}
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.from")}
                    </label>
                    <input
                      type="date"
                      value={filters.requestDateFrom}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          requestDateFrom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.to")}
                    </label>
                    <input
                      type="date"
                      value={filters.requestDateTo}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          requestDateTo: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Overtime Date Range */}
              <div className="border-l-4 border-orange-500 pl-3 sm:pl-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {t("overtime.overtimeDateRange")}
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.from")}
                    </label>
                    <input
                      type="date"
                      value={filters.overtimeDateFrom}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          overtimeDateFrom: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.to")}
                    </label>
                    <input
                      type="date"
                      value={filters.overtimeDateTo}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          overtimeDateTo: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Hours Range */}
              <div className="border-l-4 border-purple-500 pl-3 sm:pl-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {t("overtime.hoursRange")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.minHours")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.hoursMin}
                      onChange={(e) =>
                        setFilters({ ...filters, hoursMin: e.target.value })
                      }
                      placeholder="e.g., 8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t("overtime.maxHours")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={filters.hoursMax}
                      onChange={(e) =>
                        setFilters({ ...filters, hoursMax: e.target.value })
                      }
                      placeholder="e.g., 40"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end sm:col-span-2 lg:col-span-3">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {t("overtime.clearAll")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">{t("common.loading")}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {t("overtime.noRequestsFound")}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters
                ? t("overtime.tryAdjustingFilters")
                : t("overtime.noRequestsForTab")}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 p-4 sm:p-6">
            {requests.map((request) => (
              <div
                key={request.id}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Content */}
                <div className="p-4 sm:p-5">
                  {/* Employee Header - Mobile Optimized */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {request.employee?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {request.employee?.name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {request.employee?.division?.name} •{" "}
                        {request.employee?.role?.name}
                      </p>
                    </div>
                    <div className="sm:hidden">
                      {getStatusBadge(request.status, request.isIncidental)}
                    </div>
                  </div>

                  {/* Status badge - Desktop only */}
                  <div className="hidden sm:flex sm:items-center sm:gap-2 mb-3">
                    {getStatusBadge(request.status, request.isIncidental)}
                  </div>

                  {/* Desktop Layout: Info Grid + Action Buttons side by side */}
                  <div className="sm:flex sm:gap-4">
                    {/* Info Grid - Left Side */}
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                          {/* Total Hours */}
                          <div>
                            <p className="text-gray-500 text-xs mb-1">
                              {t("overtime.totalHours")}
                            </p>
                            <p className="font-semibold text-gray-900 text-sm">
                              {request.totalHours} {t("overtime.hours")}
                            </p>
                          </div>

                          {/* Overtime Dates */}
                          <div className="sm:col-span-2">
                            <p className="text-gray-500 text-xs mb-1">
                              {t("overtime.overtimeDates")}
                            </p>
                            <div className="text-sm text-gray-900">
                              {request.entries && request.entries.length > 0 ? (
                                <ul className="space-y-0.5">
                                  {request.entries
                                    .slice(0, 2)
                                    .map((entry, idx) => (
                                      <li
                                        key={idx}
                                        className="text-xs flex items-baseline"
                                      >
                                        <span className="inline-block w-1 h-1 rounded-full bg-blue-500 mr-2 mt-1.5 flex-shrink-0"></span>
                                        <span>
                                          {format(
                                            new Date(entry.date),
                                            "MMM dd, yyyy",
                                          )}{" "}
                                          ({entry.hours}h)
                                        </span>
                                      </li>
                                    ))}
                                  {request.entries.length > 2 && (
                                    <li className="text-xs text-blue-600 font-medium ml-3">
                                      +{request.entries.length - 2} more dates
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  No dates
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Entry Descriptions */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-gray-500 text-xs mb-2">
                            {t("overtime.entryDescriptions")}
                          </p>
                          <div className="space-y-2">
                            {request.entries &&
                              request.entries.slice(0, 2).map((entry, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start space-x-2"
                                >
                                  <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                  <p className="text-xs text-gray-700 flex-1 break-words">
                                    <span className="font-medium">
                                      {format(new Date(entry.date), "MMM dd")}:
                                    </span>{" "}
                                    {truncateText(entry.description, 60)}
                                  </p>
                                </div>
                              ))}
                            {request.entries && request.entries.length > 2 && (
                              <p className="text-xs text-blue-600 font-medium pl-4">
                                +{request.entries.length - 2} more entries
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Approver Info */}
                      {request.status !== "PENDING" &&
                        request.currentApprover && (
                          <p className="text-xs sm:text-sm text-gray-600">
                            {request.status === "APPROVED"
                              ? `✓ ${t("overtime.approvedBy")}`
                              : `✗ ${t("overtime.rejectedBy")}`}{" "}
                            {request.currentApprover.name}
                          </p>
                        )}
                    </div>

                    {/* Action Buttons - Right Side on Desktop, Below on Mobile */}
                    <div className="flex gap-2 sm:flex-col sm:justify-center sm:space-y-2 sm:gap-0 mt-3 sm:mt-0 sm:min-w-[200px]">
                      {/* View Details Button */}
                      <Link
                        to={`/overtime/detail/${request.id}`}
                        className="flex-1 sm:flex-none px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center transition-colors flex items-center justify-center"
                        title={t("overtime.viewDetails")}
                      >
                        <img
                          src="/detail-icon.svg"
                          alt=""
                          className="w-5 h-5 sm:hidden brightness-0 invert"
                        />
                        <span className="hidden sm:flex items-center gap-2">
                          <span className="text-sm">
                            {t("overtime.viewDetails")}
                          </span>
                        </span>
                      </Link>

                      {/* ── V2: Plan approval button (PLAN_PENDING) ───────── */}
                      {request.status === "PLAN_PENDING" && (
                        <>
                          <button
                            onClick={() =>
                              openActionModal(request, "approve-plan")
                            }
                            className="flex-1 sm:flex-none px-3 py-2 sm:px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors flex items-center justify-center"
                            title="Approve overtime plan"
                          >
                            <svg
                              className="w-5 h-5 sm:hidden"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                              />
                            </svg>
                            <span className="hidden sm:inline text-sm">
                              Approve Plan
                            </span>
                          </button>
                          <button
                            onClick={() => openActionModal(request, "reject")}
                            className="flex-1 sm:flex-none px-3 py-2 sm:px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center justify-center"
                            title={t("overtime.reject")}
                          >
                            <svg
                              className="w-5 h-5 sm:hidden"
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
                            <span className="hidden sm:inline text-sm">
                              {t("overtime.reject")}
                            </span>
                          </button>
                        </>
                      )}

                      {/* Regular approval buttons (PENDING / REVISION_REQUESTED) */}
                      {(request.status === "PENDING" ||
                        request.status === "REVISION_REQUESTED") && (
                        <>
                          <button
                            onClick={() => openActionModal(request, "approve")}
                            className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 text-white rounded-lg font-medium transition-colors flex items-center justify-center ${
                              request.isIncidental
                                ? "bg-orange-500 hover:bg-orange-600"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                            title={
                              request.isIncidental
                                ? "Approve Incidental OT"
                                : t("overtime.approve")
                            }
                          >
                            <svg
                              className="w-5 h-5 sm:hidden"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="hidden sm:inline text-sm">
                              {request.isIncidental
                                ? "Approve Incidental"
                                : t("overtime.approve")}
                            </span>
                          </button>
                          <button
                            onClick={() => openActionModal(request, "reject")}
                            className="flex-1 sm:flex-none px-3 py-2 sm:px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors flex items-center justify-center"
                            title={t("overtime.reject")}
                          >
                            <svg
                              className="w-5 h-5 sm:hidden"
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
                            <span className="hidden sm:inline text-sm">
                              {t("overtime.reject")}
                            </span>
                          </button>
                          <button
                            onClick={() => openActionModal(request, "revision")}
                            className="flex-1 sm:flex-none px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors flex items-center justify-center"
                            title={t("overtime.requestRevision")}
                          >
                            <svg
                              className="w-5 h-5 sm:hidden"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            <span className="hidden sm:inline text-sm">
                              {t("overtime.requestRevision")}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── V2: Incidental reason shown to approver ───────────── */}
                  {request.isIncidental && request.incidentalReason && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs font-semibold text-orange-800 mb-1">
                        Why no prior plan was submitted:
                      </p>
                      <p className="text-xs text-orange-700">
                        {request.incidentalReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal - Mobile Optimized */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-4 capitalize">
                {actionType === "approve"
                  ? selectedRequest?.isIncidental
                    ? "Approve Incidental Overtime"
                    : t("overtime.approve")
                  : actionType === "approve-plan"
                    ? "Approve Overtime Plan"
                    : actionType === "reject"
                      ? t("overtime.reject")
                      : t("overtime.requestRevision")}{" "}
                {actionType !== "approve-plan" && t("overtime.overtimeRequest")}
              </h2>

              {/* ── V2: Plan approval info ──────────────────────────────── */}
              {actionType === "approve-plan" && (
                <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                  You are approving the <strong>overtime plan</strong>. The
                  employee will be cleared to proceed with the planned overtime.
                  They will be asked to submit their actual hours after the date
                  passes.
                </div>
              )}

              {/* ── V2: Incidental context for approver ────────────────── */}
              {actionType === "approve" &&
                selectedRequest?.isIncidental &&
                selectedRequest?.incidentalReason && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs font-semibold text-orange-800 mb-1">
                      Employee's reason for no prior plan:
                    </p>
                    <p className="text-xs text-orange-700">
                      {selectedRequest.incidentalReason}
                    </p>
                  </div>
                )}

              <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg space-y-2">
                <p className="text-sm break-words">
                  <span className="font-medium">{t("overtime.employee")}:</span>{" "}
                  {selectedRequest.employee?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">
                    {t("overtime.totalHours")}:
                  </span>{" "}
                  {selectedRequest.totalHours}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("overtime.commentLabel")}{" "}
                  {(actionType === "reject" || actionType === "revision") && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder={t("overtime.commentPlaceholder")}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  {t("overtime.cancel")}
                </button>
                <button
                  onClick={handleAction}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                >
                  {loading ? t("overtime.processing") : t("overtime.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
