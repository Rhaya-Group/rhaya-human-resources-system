// frontend/src/pages/OvertimeHistory.jsx
// MOBILE-RESPONSIVE VERSION - Card layout, collapsible filters, horizontal tabsx

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  getMyOvertimeRequests,
  getMyOvertimeBalance,
  deleteOvertimeRequest,
} from "../api/client";
import apiClient from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { format } from "date-fns";

export default function OvertimeHistory() {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // Store unfiltered
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, PENDING, APPROVED, REJECTED
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const { t } = useTranslation();

  // Advanced filter state
  const [filters, setFilters] = useState({
    requestDateFrom: "",
    requestDateTo: "",
    overtimeDateFrom: "",
    overtimeDateTo: "",
    hoursMin: "",
    hoursMax: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
    fetchLeaveBalance();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [filters, statusFilter, allRequests]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all requests
      const requestsData = await getMyOvertimeRequests({});
      setAllRequests(requestsData);
      setRequests(requestsData);

      // Fetch balance
      const balanceData = await getMyOvertimeBalance();
      setBalance(balanceData);

      setError("");
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.error || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await apiClient.get(`/leave/balance/${currentYear}`);
      setLeaveBalance(response.data.data);
    } catch (error) {
      console.error("Failed to fetch leave balance:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...allRequests];

    // Filter by status tab
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Filter by request date range
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

    // Filter by overtime date range (check if any entry is within range)
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

    // Filter by hours range
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
      requestDateFrom: "",
      requestDateTo: "",
      overtimeDateFrom: "",
      overtimeDateTo: "",
      hoursMin: "",
      hoursMax: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  // Handle delete request
  const handleDelete = async (requestId) => {
    if (!confirm(t("overtime.deleteConfirm"))) {
      return;
    }

    try {
      setDeleteLoading(requestId);
      await deleteOvertimeRequest(requestId);

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.response?.data?.error || "Failed to delete request");
    } finally {
      setDeleteLoading(null);
    }
  };

  // Status badge component
  const StatusBadge = ({ status, isIncidental }) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      REVISION_REQUESTED: "bg-orange-100 text-orange-800",
      // V2 new statuses
      PLAN_PENDING: "bg-blue-100 text-blue-800",
      PLAN_APPROVED: "bg-teal-100 text-teal-800",
      PENDING_ACTUALIZATION: "bg-purple-100 text-purple-800",
    };

    const labels = {
      PENDING: t("overtime.pending"),
      APPROVED: t("overtime.approved"),
      REJECTED: t("overtime.rejected"),
      REVISION_REQUESTED: t("overtime.revisionRequested"),
      PLAN_PENDING: "Plan Pending",
      PLAN_APPROVED: "Plan Approved",
      PENDING_ACTUALIZATION: "Needs Actualization",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
      >
        {labels[status] || status.replace(/_/g, " ")}
        {isIncidental && (
          <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full font-semibold">
            Incidental
          </span>
        )}
      </span>
    );
  };

  // Helper function to truncate text
  const truncateText = (text, maxLength = 80) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filter stats
  const stats = {
    all: allRequests.length,
    PENDING: allRequests.filter((r) => r.status === "PENDING").length,
    APPROVED: allRequests.filter((r) => r.status === "APPROVED").length,
    REJECTED: allRequests.filter((r) => r.status === "REJECTED").length,
    REVISION_REQUESTED: allRequests.filter(
      (r) => r.status === "REVISION_REQUESTED",
    ).length,
    // V2 new statuses
    PLAN_PENDING: allRequests.filter((r) => r.status === "PLAN_PENDING").length,
    PLAN_APPROVED: allRequests.filter((r) => r.status === "PLAN_APPROVED")
      .length,
    PENDING_ACTUALIZATION: allRequests.filter(
      (r) => r.status === "PENDING_ACTUALIZATION",
    ).length,
  };

  const actualizationCount = stats.PENDING_ACTUALIZATION;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t("nav.overtime")}
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {t("overtime.viewManageRequests")}
          </p>
        </div>
        {/* Desktop Submit Button */}
        {user?.employeeStatus !== "INACTIVE" && (
          <Link
            to="/overtime/request"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            {t("overtime.submitOvertimeButton")}
          </Link>
        )}
      </div>

      {/* Balance Card - Mobile Optimized */}
      {balance && (
        <div className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-semibold mb-2">
                  {t("overtime.yourOvertimeBalance")}
                </h2>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl sm:text-4xl font-bold">
                    {balance.currentBalance.toFixed(1)}
                  </span>
                  <span className="text-lg sm:text-xl">
                    {t("overtime.hours")}
                  </span>
                </div>
                <p className="text-blue-100 text-xs sm:text-sm mt-2">
                  {(balance.currentBalance / 8).toFixed(2)}{" "}
                  {t("overtime.workingDays")}
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:text-right gap-2">
                <p className="text-xs sm:text-sm text-blue-100">
                  {t("overtime.pendingHours")}
                </p>
                <p className="text-xl sm:text-2xl font-semibold">
                  {balance.pendingHours.toFixed(1)}
                </p>
              </div>
            </div>

            {leaveBalance && (
              <div className="mt-4 pt-4 border-t border-blue-400">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-blue-100">
                    {t("overtime.convertedToLeave")}
                  </span>
                  <span className="font-semibold">
                    {leaveBalance.overtimeConverted || 0} {t("overtime.days")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced Filters - Mobile Optimized */}
      <div className="mb-4 bg-white rounded-lg shadow">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full text-left p-4 hover:bg-gray-50 transition-colors rounded-lg"
        >
          <div className="flex items-center text-sm font-medium text-gray-700">
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
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transform transition-transform flex-shrink-0 ${showFilters ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <div className="mt-4 space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
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
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {t("overtime.clearFilters")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── V2: Actualization needed alert ──────────────────────────────────── */}
      {actualizationCount > 0 && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-purple-700 font-bold text-sm">
              {actualizationCount}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-800">
              Actualization Required
            </p>
            <p className="text-xs text-purple-600">
              You have {actualizationCount} overtime request(s) that need actual
              hours to be submitted.
            </p>
          </div>
          <button
            onClick={() => setStatusFilter("PENDING_ACTUALIZATION")}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 flex-shrink-0"
          >
            Actualize Now
          </button>
        </div>
      )}

      {/* Filter Tabs - Mobile: Horizontal Scroll, Desktop: Flex */}
      <div className="mb-4 bg-white rounded-t-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          {/* Mobile: Horizontal scrollable tabs */}
          <nav className="flex sm:hidden overflow-x-auto scrollbar-hide px-2">
            {[
              "all",
              "PENDING",
              "PENDING_ACTUALIZATION",
              "PLAN_PENDING",
              "PLAN_APPROVED",
              "APPROVED",
              "REVISION_REQUESTED",
              "REJECTED",
            ].map((tab) => {
              const tabLabels = {
                all: t("overtime.allRequests"),
                PENDING: t("overtime.pending"),
                APPROVED: t("overtime.approved"),
                REJECTED: t("overtime.rejected"),
                REVISION_REQUESTED: t("overtime.revisionRequested"),
                PLAN_PENDING: "Plan Pending",
                PLAN_APPROVED: "Plan Approved",
                PENDING_ACTUALIZATION: "Actualize",
              };
              const tabColors = {
                PENDING_ACTUALIZATION: "border-purple-500 text-purple-600",
                PLAN_PENDING: "border-blue-500 text-blue-600",
                PLAN_APPROVED: "border-teal-500 text-teal-600",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`flex-shrink-0 py-3 px-3 border-b-2 font-medium text-xs transition-colors whitespace-nowrap ${
                    statusFilter === tab
                      ? tabColors[tab] || "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 active:text-gray-700"
                  }`}
                >
                  {tabLabels[tab] || tab}
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === tab ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"}`}
                  >
                    {tab === "all" ? stats.all : stats[tab] || 0}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Desktop: Normal flex tabs */}
          <nav className="hidden sm:flex px-4 space-x-4 overflow-x-auto">
            {[
              "all",
              "PENDING",
              "PENDING_ACTUALIZATION",
              "PLAN_PENDING",
              "PLAN_APPROVED",
              "APPROVED",
              "REVISION_REQUESTED",
              "REJECTED",
            ].map((tab) => {
              const tabLabels = {
                all: t("overtime.allRequests"),
                PENDING: t("overtime.pending"),
                APPROVED: t("overtime.approved"),
                REJECTED: t("overtime.rejected"),
                REVISION_REQUESTED: t("overtime.revisionRequested"),
                PLAN_PENDING: "Plan Pending",
                PLAN_APPROVED: "Plan Approved",
                PENDING_ACTUALIZATION: "Actualize",
              };
              const activeColors = {
                PENDING_ACTUALIZATION: "border-purple-500 text-purple-600",
                PLAN_PENDING: "border-blue-400 text-blue-500",
                PLAN_APPROVED: "border-teal-500 text-teal-600",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    statusFilter === tab
                      ? activeColors[tab] || "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tabLabels[tab] || tab}
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      statusFilter === tab
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab === "all" ? stats.all : stats[tab] || 0}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 bg-white rounded-b-lg">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto"
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
          <p className="text-gray-600 mt-2 text-sm">Loading...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-12 bg-white rounded-b-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {hasActiveFilters ? "No results found" : "No overtime requests"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 px-4">
            {hasActiveFilters
              ? "Try adjusting your filters to see more results."
              : "Get started by submitting your first overtime request."}
          </p>
          <div className="mt-6">
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                to="/overtime/request"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Submit Overtime
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Requests List - Mobile Optimized Card Layout */}
      {!loading && requests.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Card Header - Mobile Optimized */}
              <div className="p-4 sm:p-6">
                {/* Status and Date */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge
                        status={request.status}
                        isIncidental={request.isIncidental}
                      />
                      <span className="text-xs sm:text-sm text-gray-500">
                        {t("overtime.submittedOn")}{" "}
                        {format(new Date(request.submittedAt), "MMM dd, yyyy")}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons - Mobile: Stack, Desktop: Row */}
                  <div className="flex flex-wrap gap-2">
                    {user?.employeeStatus !== "INACTIVE" &&
                      (request.status === "PENDING" ||
                        request.status === "REVISION_REQUESTED") && (
                        <>
                          <Link
                            to={`/overtime/edit/${request.id}`}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {t("overtime.edit")}
                          </Link>
                          <button
                            onClick={() => handleDelete(request.id)}
                            disabled={deleteLoading === request.id}
                            className="flex-1 sm:flex-initial px-3 py-2 text-xs sm:text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {deleteLoading === request.id
                              ? t("overtime.deleting")
                              : t("overtime.delete")}
                          </button>
                        </>
                      )}
                    {user?.employeeStatus !== "INACTIVE" &&
                      request.status === "REJECTED" && (
                        <button
                          onClick={() => handleDelete(request.id)}
                          disabled={deleteLoading === request.id}
                          className="flex-1 sm:flex-initial px-3 py-2 text-xs sm:text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {deleteLoading === request.id
                            ? t("overtime.deleting")
                            : t("overtime.delete")}
                        </button>
                      )}
                    <Link
                      to={`/overtime/detail/${request.id}`}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      {t("overtime.viewDetails")}
                    </Link>
                  </div>
                </div>

                {/* Info Grid - Mobile Optimized */}
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {/* Total Hours */}
                    <div>
                      <p className="text-gray-500 text-xs mb-1">
                        {t("overtime.totalHours")}
                      </p>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">
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
                            {request.entries.slice(0, 2).map((entry, idx) => (
                              <li
                                key={idx}
                                className="text-xs flex items-baseline"
                              >
                                <span className="inline-block w-1 h-1 rounded-full bg-blue-500 mr-2 mt-1.5 flex-shrink-0"></span>
                                <span>
                                  {format(new Date(entry.date), "MMM dd, yyyy")}{" "}
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

                  {/* Entry Descriptions - Collapsible on Mobile */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-gray-500 text-xs mb-2">
                      {t("overtime.entryDescriptions")}
                    </p>
                    <div className="space-y-2">
                      {request.entries &&
                        request.entries.slice(0, 2).map((entry, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                            <p className="text-xs text-gray-700 flex-1">
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

                {/* Approver Info - Mobile Optimized */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                  <p className="text-gray-600">
                    {t("overtime.approver")}:{" "}
                    <span className="font-medium text-gray-900">
                      {request.currentApprover?.name || "N/A"}
                    </span>
                  </p>
                  {request.status !== "PENDING" && request.currentApprover && (
                    <p className="text-gray-600">
                      {request.status === "APPROVED"
                        ? `✓ ${t("overtime.approvedBy")}`
                        : `✗ ${t("overtime.rejectedBy")}`}{" "}
                      {request.currentApprover.name}
                    </p>
                  )}
                </div>

                {/* Approval Comments */}
                {(request.supervisorComment || request.divisionHeadComment) && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">
                      {t("overtime.comments")}
                    </h4>
                    {request.supervisorComment && (
                      <p className="text-xs sm:text-sm text-blue-800 mb-1">
                        <strong>{t("overtime.supervisor")}</strong>{" "}
                        {request.supervisorComment}
                      </p>
                    )}
                    {request.divisionHeadComment && (
                      <p className="text-xs sm:text-sm text-blue-800">
                        <strong>{t("overtime.divisionHead")}</strong>{" "}
                        {request.divisionHeadComment}
                      </p>
                    )}
                  </div>
                )}

                {/* ── V2: Incidental reason display ──────────────────────── */}
                {request.isIncidental && request.incidentalReason && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-xs font-semibold text-orange-800 mb-1">
                      Incidental Reason
                    </p>
                    <p className="text-xs text-orange-700">
                      {request.incidentalReason}
                    </p>
                  </div>
                )}

                {/* ── V2: Plan approved info box ──────────────────────────── */}
                {request.status === "PLAN_APPROVED" && (
                  <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <p className="text-xs font-semibold text-teal-800 mb-1">
                      📋 Plan Approved
                    </p>
                    <p className="text-xs text-teal-700">
                      Your overtime plan has been approved. After completing the
                      overtime, you'll receive a reminder to submit your actual
                      hours.
                    </p>
                  </div>
                )}

                {/* ── V2: Actualization needed banner + button ────────────── */}
                {request.status === "PENDING_ACTUALIZATION" && (
                  <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-purple-800 mb-1">
                          ⏰ Actualization Required
                        </p>
                        <p className="text-xs text-purple-700">
                          Your overtime date has passed. Please submit your
                          actual hours worked.
                        </p>
                      </div>
                      <Link
                        to={`/overtime/actualize/${request.id}`}
                        className="flex-shrink-0 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
                      >
                        Actualize
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button (FAB) - Mobile Only */}
      <Link
        to="/overtime/request"
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center z-50 group"
        aria-label={t("overtime.submitOvertimeButton")}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>

        {/* Tooltip on hover/long-press */}
        <span className="absolute right-full mr-3 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {t("overtime.submitOvertimeButton")}
          {/* Arrow */}
          <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900"></span>
        </span>
      </Link>
    </div>
  );
}
