// frontend/src/pages/OvertimeRequest.jsx
// MOBILE-RESPONSIVE VERSION - Card layout on mobile, table on desktop

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { submitOvertimeRequest } from "../api/client";
import apiClient from "../api/client";
import { format, subDays, getDay, addDays } from "date-fns";
import i18n from "../i18n";
import DatePicker from "react-datepicker";
import { registerLocale } from "react-datepicker";
import { id, enUS } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

export default function OvertimeRequest() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [entries, setEntries] = useState([
    { date: "", hours: "", description: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastRecapDate, setLastRecapDate] = useState(null);

  // ── V2: Policy + incidental state ──────────────────────────────────────────
  const [overtimeMode, setOvertimeMode] = useState("post"); // 'pre' | 'post'
  const [incidentalReason, setIncidentalReason] = useState("");
  const [subFlow, setSubFlow] = useState(null); // null | 'flow1' | 'flow2a' | 'flow2b'

  useEffect(() => {
    fetchLastRecapDate();
    fetchOvertimePolicy();
  }, []);

  // Calculate date limits
  const fetchLastRecapDate = async () => {
    try {
      const res = await apiClient.get("/overtime-recap/system-settings");
      setLastRecapDate(res.data?.data?.lastRecapDate || null);
    } catch (error) {
      console.error("Failed to fetch last recap date:", error);
    }
  };

  // ── V2: Fetch entity overtime policy ───────────────────────────────────────
  const fetchOvertimePolicy = async () => {
    try {
      const res = await apiClient.get("/policy-templates/my-policy-url");
      const resolvedMode = res.data?.data?.overtimeMode || "post";
      setOvertimeMode(resolvedMode);
    } catch (err) {
      console.error("Failed to fetch overtime policy:", err);
    }
  };

  // ── V2: Detect subflow whenever entries or mode changes ───────────────────
  useEffect(() => {
    if (!entries.length) return;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const allFuture = entries.every(
      (e) => e.date && new Date(e.date + "T00:00:00") > today,
    );
    const allPastOrToday = entries.every(
      (e) => e.date && new Date(e.date + "T00:00:00") <= today,
    );
    const hasDates = entries.some((e) => e.date);

    if (!hasDates) {
      setSubFlow(null);
      return;
    }

    if (overtimeMode === "post") {
      setSubFlow("flow1");
    } else if (overtimeMode === "pre" && allFuture) {
      setSubFlow("flow2a");
    } else if (overtimeMode === "pre" && allPastOrToday) {
      setSubFlow("flow2b");
    } else {
      setSubFlow(null); // mixed dates — invalid
    }
  }, [entries, overtimeMode]);

  // Calculate date limits with recap restriction
  const getMinDate = () => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    if (lastRecapDate) {
      const recapCutoff = new Date(lastRecapDate);
      const dayAfterRecap = addDays(recapCutoff, 1);
      const minDate =
        dayAfterRecap > sevenDaysAgo ? dayAfterRecap : sevenDaysAgo;
      return minDate;
    }

    return sevenDaysAgo;
  };

  const getMaxDate = () => {
    // Pre-mode: allow future dates (planned overtime)
    if (overtimeMode === "pre") return addDays(new Date(), 90);
    // Post-mode: today only
    return new Date();
  };

  // ── V2: Flag whether dates are mixed (invalid for pre-mode) ───────────────
  const hasMixedDates = () => {
    if (overtimeMode !== "pre") return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const filledDates = entries.filter((e) => e.date);
    if (filledDates.length < 2) return false;
    const hasFuture = filledDates.some(
      (e) => new Date(e.date + "T00:00:00") > today,
    );
    const hasPast = filledDates.some(
      (e) => new Date(e.date + "T00:00:00") <= today,
    );
    return hasFuture && hasPast;
  };

  // Register Indonesian locale
  registerLocale("id", id);
  registerLocale("en", enUS);

  // Check if date is a weekday
  const isWeekday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString + "T00:00:00");
    const day = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    return day >= 1 && day <= 5; // Monday to Friday
  };

  // Get day name from date
  const getDayName = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    return format(date, "EEEE"); // Full day name (e.g., "Monday")
  };

  const isLastEntryFilled = () => {
    if (entries.length === 0) return true;
    const lastEntry = entries[entries.length - 1];
    return lastEntry.date && lastEntry.hours && lastEntry.description;
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
    setError(""); // Clear error on change
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
    // Check mixed dates (pre-mode only)
    if (hasMixedDates()) {
      setError(
        "Cannot mix past and future dates in one request. Submit them separately.",
      );
      return false;
    }

    // Check all fields filled
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

      const entryDate = new Date(entry.date + "T00:00:00");
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Post-mode and incidental: past dates only within H+7
      if (subFlow === "flow1" || subFlow === "flow2b") {
        const minDate = getMinDate();
        minDate.setHours(0, 0, 0, 0);
        if (entryDate < minDate) {
          setError(
            `${t("common.entry")} ${i + 1}: ${t("overtime.dateMoreThan7Days")}`,
          );
          return false;
        }
        if (entryDate > today) {
          setError(
            `${t("common.entry")} ${i + 1}: ${t("overtime.cannotSubmitFuture")}`,
          );
          return false;
        }
      }
    }

    // Incidental reason required for flow2b
    if (subFlow === "flow2b" && !incidentalReason.trim()) {
      setError(
        "Please explain why no prior plan was submitted (required for incidental overtime).",
      );
      return false;
    }

    // Duplicate dates
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

    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        entries: entries.map((entry) => ({
          date: entry.date,
          hours: parseFloat(entry.hours),
          description: entry.description.trim(),
        })),
      };

      // Include incidentalReason for flow2b
      if (subFlow === "flow2b") {
        payload.incidentalReason = incidentalReason.trim();
      }

      await submitOvertimeRequest(payload);

      const msg =
        subFlow === "flow2a"
          ? "Overtime plan submitted! Waiting for supervisor approval."
          : "Overtime request submitted successfully!";
      setSuccess(msg);

      setTimeout(() => {
        navigate("/overtime/history");
      }, 2000);
    } catch (err) {
      console.error("Submit error:", err);
      setError(
        err.response?.data?.error || err.message || t("overtime.submitError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
          {t("overtime.submitTitle")}
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
          {t("overtime.submitDescription")}
        </p>
      </div>

      {/* Info Alert - Mobile Responsive */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="ml-3 flex-1">
            <p className="text-xs sm:text-sm text-blue-700">
              <strong className="font-semibold">
                {t("overtime.importantNotes")}
              </strong>
              <br />• {t("overtime.note1")}
              <br />• {t("overtime.note2", { max: 5 })}
              <br />• {t("overtime.note3")}
              <br />• {t("overtime.note4")}
              <br />
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded">
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded">
          <p className="text-xs sm:text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* ── V2: Subflow indicator banner ──────────────────────────────────── */}
      {overtimeMode === "pre" && subFlow === "flow2a" && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-4 mb-4 rounded">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                📋 Planned Overtime
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                You are submitting an overtime <strong>plan</strong> for future
                dates. Your supervisor will approve the plan first. After
                completing the overtime, you'll need to actualize your actual
                hours.
              </p>
            </div>
          </div>
        </div>
      )}

      {overtimeMode === "pre" && subFlow === "flow2b" && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 sm:p-4 mb-4 rounded">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-800">
                ⚡ Incidental Overtime
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                You are submitting overtime without a prior plan. Your
                supervisor will see this marked as <strong>Incidental</strong>.
                Please provide a reason below.
              </p>
            </div>
          </div>
        </div>
      )}

      {overtimeMode === "pre" && hasMixedDates() && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 mb-4 rounded">
          <p className="text-sm text-red-700">
            ⚠️ <strong>Mixed dates detected.</strong> You cannot mix past and
            future dates in one request. Please submit planned overtime (future
            dates) and incidental overtime (past dates) separately.
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
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
                  {entry.date && (
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-medium px-2 py-1 rounded ${
                          isWeekday(entry.date)
                            ? "bg-yellow-400 text-yellow-900"
                            : "bg-green-400 text-green-900"
                        }`}
                      >
                        {getDayName(entry.date)}
                      </span>
                      {isWeekday(entry.date) && (
                        <div className="flex items-center justify-center w-5 h-5 bg-yellow-400 border-2 border-yellow-300 rounded-full">
                          <span className="text-yellow-900 text-xs font-bold">
                            !
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
                {/* Weekday Warning */}
                {isWeekday(entry.date) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <svg
                        className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="flex-1 text-xs text-yellow-800">
                        <div className="font-semibold">
                          {t("overtime.weekdaySelected")}
                        </div>
                        <div className="mt-1">
                          {t("overtime.weekdayWarning")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("overtime.date")} <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={
                      entry.date ? new Date(entry.date + "T00:00:00") : null
                    }
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(
                          2,
                          "0",
                        );
                        const day = String(date.getDate()).padStart(2, "0");
                        const formattedDate = `${year}-${month}-${day}`;
                        updateEntry(index, "date", formattedDate);
                      }
                    }}
                    minDate={getMinDate()}
                    maxDate={getMaxDate()}
                    dateFormat="dd/MM/yyyy"
                    locale={i18n.language === "id" ? "id" : "en"}
                    placeholderText={t("overtime.selectDate")}
                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    wrapperClassName="w-full"
                    required
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                  />
                </div>

                {/* Hours Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("overtime.hours")}{" "}
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
                    {t("overtime.description")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={entry.description}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        updateEntry(index, "description", e.target.value);
                      }
                    }}
                    placeholder={t("overtime.descriptionPlaceholder")}
                    className="w-full px-3 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                    rows="4"
                    maxLength="500"
                    required
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {t("overtime.supportsFormatting")}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        entry.description.length >= 450
                          ? "text-red-600"
                          : entry.description.length >= 400
                            ? "text-yellow-600"
                            : "text-gray-500"
                      }`}
                    >
                      {entry.description.length}/500
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Entry Button - Mobile */}
          <button
            type="button"
            onClick={addEntry}
            disabled={entries.length >= 5 || !isLastEntryFilled()}
            className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-blue-700 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors"
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
            {entries.length >= 5 && (
              <span className="ml-2 text-xs">(max 5)</span>
            )}
          </button>
          {!isLastEntryFilled() && entries.length < 5 && (
            <p className="text-center text-xs text-gray-500 -mt-2">
              {t("overtime.fillPreviousEntry")}
            </p>
          )}
        </div>

        {/* DESKTOP VIEW: Table layout */}
        <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    {t("overtime.tableDay")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    {t("overtime.tableDate")}{" "}
                    <span className="text-red-500">*</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    {t("overtime.tableHours")}{" "}
                    <span className="text-red-500">*</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("overtime.tableDescription")}{" "}
                    <span className="text-red-500">*</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    {t("overtime.tableAction")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {/* Number */}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>

                    {/* Day Name */}
                    <td className="px-4 py-3">
                      {entry.date ? (
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm font-medium ${
                              isWeekday(entry.date)
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {getDayName(entry.date)}
                          </span>

                          {/* Weekday Warning Icon */}
                          {isWeekday(entry.date) && (
                            <div className="group relative">
                              <div className="flex items-center justify-center w-5 h-5 bg-yellow-100 border-2 border-yellow-400 rounded-full cursor-help">
                                <span className="text-yellow-600 text-xs font-bold">
                                  !
                                </span>
                              </div>

                              {/* Tooltip */}
                              <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 hidden group-hover:block z-50 pointer-events-none">
                                <div
                                  className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg"
                                  style={{ minWidth: "250px" }}
                                >
                                  <div className="font-semibold mb-1">
                                    {t("overtime.weekdaySelected")}
                                  </div>
                                  <div>{t("overtime.weekdayWarning")}</div>
                                  <div className="text-gray-300 mt-1">
                                    {t("overtime.verifyDate")}
                                  </div>

                                  {/* Tooltip Arrow */}
                                  <div className="absolute right-full top-1/2 transform -translate-y-1/2">
                                    <div className="border-8 border-transparent border-r-gray-900"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Date Column */}
                    <td className="px-4 py-3">
                      <DatePicker
                        selected={
                          entry.date ? new Date(entry.date + "T00:00:00") : null
                        }
                        onChange={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(
                              2,
                              "0",
                            );
                            const day = String(date.getDate()).padStart(2, "0");
                            const formattedDate = `${year}-${month}-${day}`;
                            updateEntry(index, "date", formattedDate);
                          }
                        }}
                        minDate={getMinDate()}
                        maxDate={getMaxDate()}
                        dateFormat="dd/MM/yyyy"
                        locale={i18n.language === "id" ? "id" : "en"}
                        placeholderText={t("overtime.selectDate")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        wrapperClassName="w-full"
                        required
                        showYearDropdown
                        showMonthDropdown
                        dropdownMode="select"
                      />
                    </td>

                    {/* Hours Column */}
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
                        className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </td>

                    {/* Description Column */}
                    <td className="px-4 py-3">
                      <div className="w-full">
                        <textarea
                          value={entry.description}
                          onChange={(e) => {
                            if (e.target.value.length <= 500) {
                              updateEntry(index, "description", e.target.value);
                            }
                          }}
                          placeholder={t("overtime.descriptionPlaceholder")}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                          rows="3"
                          maxLength="500"
                          required
                        />
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">
                            {t("overtime.supportsFormatting")}
                          </span>
                          <span
                            className={`text-xs ${
                              entry.description.length >= 450
                                ? "text-red-600 font-medium"
                                : entry.description.length >= 400
                                  ? "text-yellow-600"
                                  : "text-gray-500"
                            }`}
                          >
                            {entry.description.length}/500
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action Column */}
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
              disabled={entries.length >= 5 || !isLastEntryFilled()}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
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
              {entries.length >= 5 && (
                <span className="ml-2 text-xs">(max 5)</span>
              )}
            </button>
            {!isLastEntryFilled() && entries.length < 5 && (
              <p className="mt-2 text-xs text-gray-500">
                {t("overtime.fillPreviousEntry")}
              </p>
            )}
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

          {/* ── V2: Incidental reason field (flow2b only) ──────────────────── */}
          {subFlow === "flow2b" && (
            <div className="px-4 py-4 border-b border-orange-100 bg-orange-50">
              <label className="block text-sm font-medium text-orange-800 mb-2">
                ⚡ Reason for no prior plan{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={incidentalReason}
                onChange={(e) => setIncidentalReason(e.target.value)}
                rows={3}
                required
                placeholder="e.g. Urgent client request came in at 6pm — could not plan ahead."
                className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
              />
              <p className="text-xs text-orange-600 mt-1">
                This will be shown to your supervisor when they review the
                request.
              </p>
            </div>
          )}

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
                disabled={loading || hasMixedDates()}
                className={`w-full sm:w-auto order-1 sm:order-2 px-6 py-3 text-sm font-medium text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm ${
                  subFlow === "flow2b"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : subFlow === "flow2a"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? (
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
                    {t("overtime.submitting")}
                  </span>
                ) : subFlow === "flow2a" ? (
                  "📋 Submit Overtime Plan"
                ) : subFlow === "flow2b" ? (
                  "⚡ Submit Incidental Overtime"
                ) : (
                  t("overtime.submitRequest")
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
