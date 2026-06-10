// frontend/src/pages/OvertimeActualize.jsx
// Submit actual hours worked for a plan-approved overtime request

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getOvertimeRequestById,
  actualizeOvertimeRequest,
} from "../api/client";
import { format } from "date-fns";

export default function OvertimeActualize() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [actualHours, setActualHours] = useState({}); // entryId → string
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequestById(requestId);

      const actualizableStatuses = ["PENDING_ACTUALIZATION", "PLAN_APPROVED"];
      if (!actualizableStatuses.includes(data.status)) {
        setError(`This request cannot be actualized (status: ${data.status}).`);
        setTimeout(() => navigate("/overtime/history"), 2000);
        return;
      }

      // For PLAN_APPROVED, check all dates have passed
      if (data.status === "PLAN_APPROVED") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureDates = data.entries.filter(
          (e) => new Date(e.date) > today,
        );
        if (futureDates.length > 1) {
          setError(
            "Some overtime dates have not passed yet. Please check back later.",
          );
          setTimeout(() => navigate("/overtime/history"), 2500);
          return;
        }
      }

      setRequest(data);
      // Pre-fill actual hours with planned hours as default
      const defaults = {};
      data.entries.forEach((e) => {
        defaults[e.id] = String(e.plannedHours ?? e.hours);
      });
      setActualHours(defaults);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.error || "Failed to load overtime request.");
      setTimeout(() => navigate("/overtime/history"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const updateHours = (entryId, value) => {
    setActualHours((prev) => ({ ...prev, [entryId]: value }));
    setError("");
  };

  const totalActual = request
    ? request.entries.reduce((sum, e) => {
        const h = parseFloat(actualHours[e.id]) || 0;
        return sum + h;
      }, 0)
    : 0;

  const totalPlanned = request
    ? request.entries.reduce((sum, e) => sum + (e.plannedHours ?? e.hours), 0)
    : 0;

  const exceedsPlanned = totalActual > totalPlanned;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate
    for (const entry of request.entries) {
      const h = parseFloat(actualHours[entry.id]);
      if (isNaN(h) || h < 0 || h > 12) {
        setError(
          `Entry for ${format(new Date(entry.date), "MMM dd, yyyy")}: actual hours must be between 0 and 12. Enter 0 if overtime was cancelled.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const entries = request.entries.map((e) => ({
        entryId: e.id,
        actualHours: parseFloat(actualHours[e.id]),
      }));

      await actualizeOvertimeRequest(requestId, entries);

      setSuccess(
        exceedsPlanned
          ? "Actual hours submitted. Since actual hours exceed the plan, this request has been re-routed to your supervisor for approval."
          : "Actual hours submitted successfully! Your overtime has been approved.",
      );
      setTimeout(() => navigate("/overtime/history"), 3000);
    } catch (err) {
      console.error("Actualize error:", err);
      setError(err.response?.data?.error || "Failed to submit actual hours.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-purple-600 mx-auto"
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-600">
            Loading overtime request…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Submit Actual Hours
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          Enter the actual hours worked for each overtime date.
        </p>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {request && !success && (
        <form onSubmit={handleSubmit}>
          {/* Info box */}
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs font-semibold text-purple-800 mb-1">
              ⏰ Actualization Required
            </p>
            <p className="text-xs text-purple-700">
              Your overtime date has passed. Please confirm the actual hours you
              worked. Enter <strong>0</strong> for any date where overtime was
              cancelled or not performed.
            </p>
          </div>

          {/* Exceeds-planned warning */}
          {exceedsPlanned && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs font-semibold text-orange-800 mb-1">
                Actual hours exceed plan ({totalActual.toFixed(1)}h &gt;{" "}
                {totalPlanned.toFixed(1)}h planned)
              </p>
              <p className="text-xs text-orange-700">
                This request will be re-routed to your supervisor for
                re-approval.
              </p>
            </div>
          )}

          {/* Entries */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">
                Overtime Entries
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {request.entries.map((entry, idx) => {
                const planned = entry.plannedHours ?? entry.hours;
                const actual = parseFloat(actualHours[entry.id]) || 0;
                const diff = actual - planned;
                return (
                  <div key={entry.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Entry number + date */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-700 font-bold text-xs">
                            {idx + 1}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {format(new Date(entry.date), "EEE, MMM dd yyyy")}
                          </p>
                          {entry.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {entry.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            Planned:{" "}
                            <span className="font-medium">{planned}h</span>
                          </p>
                        </div>
                      </div>

                      {/* Actual hours input */}
                      <div className="flex items-center gap-2 sm:w-36">
                        <label className="text-xs text-gray-600 sm:hidden">
                          Actual hours:
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="12"
                          value={actualHours[entry.id] ?? ""}
                          onChange={(e) =>
                            updateHours(entry.id, e.target.value)
                          }
                          className={`w-full sm:w-24 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                            diff > 0
                              ? "border-orange-300 bg-orange-50"
                              : diff < 0
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-300"
                          }`}
                          placeholder="0"
                          required
                        />
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          h
                        </span>
                        {diff !== 0 && !isNaN(diff) && (
                          <span
                            className={`text-xs font-medium flex-shrink-0 ${
                              diff > 0 ? "text-orange-600" : "text-blue-600"
                            }`}
                          >
                            {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary row */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Planned total:{" "}
                <span className="font-semibold">
                  {totalPlanned.toFixed(1)}h
                </span>
              </div>
              <div
                className={`text-sm font-bold ${exceedsPlanned ? "text-orange-600" : "text-gray-900"}`}
              >
                Actual total: {totalActual.toFixed(1)}h
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate("/overtime/history")}
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting…
                </span>
              ) : (
                "Submit Actual Hours"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
