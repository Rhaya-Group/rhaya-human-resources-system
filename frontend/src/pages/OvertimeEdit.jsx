// frontend/src/pages/OvertimeEdit.jsx
// MOBILE-RESPONSIVE VERSION - Card layout on mobile, table on desktop

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOvertimeRequestById, editOvertimeRequest } from "../api/client";
import apiClient from "../api/client";
import { format, subDays, addDays } from "date-fns";

export default function OvertimeEdit() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [originalRequest, setOriginalRequest] = useState(null);
  const [lastRecapDate, setLastRecapDate] = useState(null);

  // Calculate date limits
  const fetchLastRecapDate = async () => {
    try {
      const res = await apiClient.get("/overtime-recap/system-settings");
      setLastRecapDate(res.data?.data?.lastRecapDate || null);
    } catch (error) {
      console.error("Failed to fetch last recap date:", error);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    if (lastRecapDate) {
      const recapCutoff = new Date(lastRecapDate);
      const dayAfterRecap = addDays(recapCutoff, 1);
      const minDate =
        dayAfterRecap > sevenDaysAgo ? dayAfterRecap : sevenDaysAgo;
      return format(minDate, "yyyy-MM-dd");
    }

    return format(sevenDaysAgo, "yyyy-MM-dd");
  };

  const getMaxDate = () => {
    return format(new Date(), "yyyy-MM-dd");
  };

  useEffect(() => {
    fetchRequest();
    fetchLastRecapDate();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequestById(requestId);

      // Check if request can be edited
      if (data.status !== "PENDING" && data.status !== "REVISION_REQUESTED") {
        setError(t("overtime.onlyPendingCanEdit"));
        setTimeout(() => navigate("/overtime/history"), 2000);
        return;
      }

      setOriginalRequest(data);

      // Convert entries to editable format
      const editableEntries = data.entries.map((entry) => ({
        date: format(new Date(entry.date), "yyyy-MM-dd"),
        hours: entry.hours.toString(),
        description: entry.description,
      }));

      setEntries(editableEntries);
      setError("");
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || t("overtime.failedToLoad"));
      setTimeout(() => navigate("/overtime/history"), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Add new entry row
  const addEntry = () => {
    setEntries([...entries, { date: "", hours: "", description: "" }]);
  };

  // Remove entry row
  const removeEntry = (index) => {
    if (entries.length === 1) {
      setError(t("overtime.atLeastOneEntry"));
      return;
    }
    const newEntries = entries.filter((_, i) => i !== index);
    setEntries(newEntries);
  };

  // Update entry field
  const updateEntry = (index, field, value) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
    setError("");
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalHours = entries.reduce((sum, entry) => {
      const hours = parseFloat(entry.hours) || 0;
      return sum + hours;
    }, 0);

    return {
      hours: totalHours.toFixed(1),
      days: (totalHours / 8).toFixed(2),
    };
  };

  // Validate form
  const validateForm = () => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.date || !entry.hours || !entry.description.trim()) {
        setError(
          `${t("common.entry")} ${i + 1}: ${t("overtime.allFieldsRequired")}`,
        );
        return false;
      }

      const hours = parseFloat(entry.hours);
      if (isNaN(hours) || hours <= 0 || hours > 12) {
        setError(
          `${t("common.entry")} ${i + 1}: ${t("overtime.hoursBetween")}`,
        );
        return false;
      }

      const entryDate = new Date(entry.date);
      const minDate = new Date(getMinDate());
      const maxDate = new Date(getMaxDate());

      if (entryDate < minDate) {
        setError(
          `${t("common.entry")} ${i + 1}: ${t("overtime.dateMoreThan7Days")}`,
        );
        return false;
      }

      if (entryDate > maxDate) {
        setError(
          `${t("common.entry")} ${i + 1}: ${t("overtime.cannotSubmitFuture")}`,
        );
        return false;
      }
    }

    const dates = entries.map((e) => e.date);
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      setError(t("overtime.duplicateDates"));
      return false;
    }

    return true;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      await editOvertimeRequest(requestId, {
        entries: entries.map((entry) => ({
          date: entry.date,
          hours: parseFloat(entry.hours),
          description: entry.description.trim(),
        })),
      });

      setSuccess(t("overtime.updateSuccess"));

      setTimeout(() => {
        navigate("/overtime/history");
      }, 2000);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || t("overtime.updateError"));
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

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

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {t("overtime.editTitle")}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1">
          {t("overtime.editDescription")}
        </p>
      </div>

      {/* Revision Comment Alert - Mobile Optimized */}
      {originalRequest?.supervisorComment &&
        originalRequest?.status === "REVISION_REQUESTED" && (
          <div className="mb-4 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-orange-900">
                  {t("overtime.revisionRequested")}
                </h3>
                <p className="text-xs sm:text-sm text-orange-800 mt-1 break-words">
                  {originalRequest.supervisorComment}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Alert Messages */}
      {error && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs sm:text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs sm:text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Guidelines - Mobile Optimized */}
        <div className="mb-4 p-3 sm:p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2 sm:space-x-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-medium text-blue-900">
                {t("overtime.editGuidelines")}
              </h3>
              <ul className="mt-1 text-xs sm:text-sm text-blue-800 list-disc list-inside space-y-1">
                <li>{t("overtime.editNote1")}</li>
                <li>{t("overtime.editNote2")}</li>
                <li>{t("overtime.editNote3")}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* MOBILE VIEW: Card-based layout */}
        <div className="block lg:hidden space-y-4">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      #{index + 1}
                    </span>
                  </div>
                  <span className="text-white text-sm font-medium">
                    {t("common.entry")} {index + 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  disabled={entries.length === 1}
                  className="text-white hover:text-red-200 disabled:text-gray-400 disabled:cursor-not-allowed p-1"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Date Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("overtime.tableDate")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateEntry(index, "date", e.target.value)}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Hours Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("overtime.tableHours")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={entry.hours}
                    onChange={(e) =>
                      updateEntry(index, "hours", e.target.value)
                    }
                    placeholder={t("overtime.hoursPlaceholder")}
                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t("overtime.hoursBetween")}
                  </p>
                </div>

                {/* Description Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("overtime.tableDescription")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={entry.description}
                    onChange={(e) =>
                      updateEntry(index, "description", e.target.value)
                    }
                    placeholder={t("overtime.descriptionPlaceholder")}
                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                    rows="4"
                    required
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Entry Button - Mobile */}
          <button
            type="button"
            onClick={addEntry}
            className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            {t("overtime.addAnotherDate")}
          </button>
        </div>

        {/* DESKTOP VIEW: Table layout */}
        <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableNumber")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableDate")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableHours")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableDescription")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableAction")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) =>
                          updateEntry(index, "date", e.target.value)
                        }
                        min={getMinDate()}
                        max={getMaxDate()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="12"
                        value={entry.hours}
                        onChange={(e) =>
                          updateEntry(index, "hours", e.target.value)
                        }
                        placeholder={t("overtime.hoursPlaceholder")}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) =>
                          updateEntry(index, "description", e.target.value)
                        }
                        placeholder={t("overtime.descriptionPlaceholder")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={entries.length === 1}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Entry Button - Desktop */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={addEntry}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
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
              {t("overtime.addAnotherDate")}
            </button>
          </div>
        </div>

        {/* Summary & Actions - Mobile Optimized */}
        <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {/* Summary Section */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-4 border-b border-gray-200">
            <p className="text-xs sm:text-sm text-gray-600 font-medium mb-2">
              {t("overtime.totalSummary")}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {totals.hours}
              </span>
              <span className="text-sm sm:text-base text-gray-600">
                {t("overtime.hours")}
              </span>
              <span className="text-xs sm:text-sm text-gray-500">
                ({totals.days} {t("overtime.days")})
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-4 bg-white">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => navigate("/overtime/history")}
                className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t("overtime.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    {t("overtime.updating")}
                  </span>
                ) : (
                  t("overtime.updateRequest")
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
