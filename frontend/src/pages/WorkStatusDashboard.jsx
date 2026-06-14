// frontend/src/pages/WorkStatusDashboard.jsx
// Work Status / Attendance tracking dashboard — WFO/WFH/LEAVE/OUTSIDE_OFFICE

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
} from "../api/client";
import {
  Home,
  Monitor,
  MapPin,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  X,
  Edit3,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  WFO: {
    label: "WFO",
    fullLabel: "Work From Office",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    icon: Home,
    iconColor: "text-emerald-600",
  },
  WFH: {
    label: "WFH",
    fullLabel: "Work From Home",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    icon: Monitor,
    iconColor: "text-blue-600",
  },
  OUTSIDE_OFFICE: {
    label: "Outside",
    fullLabel: "Outside Office",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
    icon: MapPin,
    iconColor: "text-purple-600",
  },
  LEAVE: {
    label: "Leave",
    fullLabel: "On Leave",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    icon: CalendarOff,
    iconColor: "text-orange-600",
  },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isTodayOrFuture(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target >= today;
}

function getWeekDates(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7)); // Mon
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday);
    nd.setDate(monday.getDate() + i);
    return nd;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WFO;
  const Icon = cfg.icon;
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${cfg.color} ${sizeClass}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function StatusPicker({ currentStatus, onSelect, onCancel, canReset }) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px]">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
        const Icon = cfg.icon;
        const isActive = currentStatus === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-gray-100 ring-1 ring-gray-300"
                : "hover:bg-gray-50"
            }`}
          >
            <Icon size={14} className={cfg.iconColor} />
            {cfg.fullLabel}
            {isActive && <Check size={12} className="ml-auto text-gray-500" />}
          </button>
        );
      })}
      {canReset && currentStatus !== "WFO" && (
        <button
          onClick={() => onSelect("RESET")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-1"
        >
          <X size={12} />
          Reset to WFO
        </button>
      )}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────

function TodayView({ user, employees, statuses, statusMap, todayStr, onStatusChange, saving }) {
  const [editing, setEditing] = useState(null); // employeeId being edited
  const [noteInput, setNoteInput] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null);

  const canModify = useCallback(
    (empId) => {
      if (!user) return false;
      if (user.accessLevel <= 2) return true;
      if (user.id === empId) return true;
      // SPV/manager — subordinate check simplified: if employee shows up in list, they're visible
      if (user.accessLevel <= 4) return true; // we already filter list server-side
      return user.id === empId;
    },
    [user]
  );

  const handleSelect = async (empId, newStatus) => {
    setEditing(null);
    if (newStatus === "RESET") {
      const existingKey = `${empId}::${todayStr}`;
      const existing = statusMap[existingKey];
      if (existing) {
        await onStatusChange("delete", existing.id, empId, todayStr);
      }
      return;
    }
    if (newStatus === "OUTSIDE_OFFICE" && !showNoteFor) {
      setShowNoteFor(empId);
      return;
    }
    await onStatusChange("set", null, empId, todayStr, newStatus, null);
  };

  const handleNoteSubmit = async (empId) => {
    setShowNoteFor(null);
    await onStatusChange("set", null, empId, todayStr, "OUTSIDE_OFFICE", noteInput);
    setNoteInput("");
  };

  // Group by entity
  const grouped = useMemo(() => {
    const map = {};
    for (const emp of employees) {
      const entityName = emp.plottingCompany?.name || "Unassigned";
      if (!map[entityName]) map[entityName] = [];
      map[entityName].push(emp);
    }
    return map;
  }, [employees]);

  // Summary counts
  const counts = useMemo(() => {
    const c = { WFO: 0, WFH: 0, OUTSIDE_OFFICE: 0, LEAVE: 0 };
    for (const emp of employees) {
      const key = `${emp.id}::${todayStr}`;
      const s = statusMap[key]?.status || "WFO";
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [employees, statusMap, todayStr]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div
              key={key}
              className={`rounded-xl border p-4 flex items-center gap-3 ${cfg.color}`}
            >
              <Icon size={20} />
              <div>
                <div className="text-2xl font-bold">{counts[key] || 0}</div>
                <div className="text-xs font-medium">{cfg.fullLabel}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Employee list grouped by entity */}
      {Object.entries(grouped).map(([entityName, emps]) => (
        <div key={entityName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{entityName}</h3>
            <p className="text-xs text-gray-500">{emps.length} employee{emps.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {emps.map((emp) => {
              const key = `${emp.id}::${todayStr}`;
              const record = statusMap[key];
              const currentStatus = record?.status || "WFO";
              const isEditing = editing === emp.id;
              const isShowingNote = showNoteFor === emp.id;
              const editable = canModify(emp.id) && isTodayOrFuture(todayStr);

              return (
                <div key={emp.id} className="relative">
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                      {emp.name?.charAt(0)?.toUpperCase()}
                    </div>

                    {/* Name + division */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {emp.id === user?.id ? `${emp.name} (You)` : emp.name}
                      </div>
                      {emp.division && (
                        <div className="text-xs text-gray-500 truncate">{emp.division.name}</div>
                      )}
                    </div>

                    {/* Status badge + edit button */}
                    <div className="flex items-center gap-2">
                      <StatusBadge status={currentStatus} />
                      {record?.note && (
                        <span className="text-xs text-gray-400 italic truncate max-w-[100px]" title={record.note}>
                          {record.note}
                        </span>
                      )}
                      {editable && (
                        <button
                          onClick={() => setEditing(isEditing ? null : emp.id)}
                          disabled={saving}
                          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Change status"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status picker dropdown */}
                  {isEditing && (
                    <div className="absolute right-4 top-full mt-1 z-50">
                      <StatusPicker
                        currentStatus={currentStatus}
                        onSelect={(s) => handleSelect(emp.id, s)}
                        onCancel={() => setEditing(null)}
                        canReset={!!record}
                      />
                    </div>
                  )}

                  {/* Note input for OUTSIDE_OFFICE */}
                  {isShowingNote && (
                    <div className="px-4 pb-3 flex gap-2">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add note (e.g. client visit, field work)"
                        className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNoteSubmit(emp.id);
                          if (e.key === "Escape") { setShowNoteFor(null); setNoteInput(""); }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleNoteSubmit(emp.id)}
                        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setShowNoteFor(null); setNoteInput(""); }}
                        className="px-3 py-1.5 text-gray-500 text-sm rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {employees.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Home size={40} className="mx-auto mb-3 opacity-30" />
          <p>No team members to display</p>
        </div>
      )}
    </div>
  );
}

// ─── Week Tab ─────────────────────────────────────────────────────────────────

function WeekView({ user, employees, statuses, statusMap, weekDates, onStatusChange, saving }) {
  const today = formatDate(new Date());

  const canModify = useCallback(
    (empId) => {
      if (!user) return false;
      if (user.accessLevel <= 2) return true;
      if (user.accessLevel <= 4) return true;
      return user.id === empId;
    },
    [user]
  );

  const [editing, setEditing] = useState(null); // { empId, dateStr }
  const [noteInput, setNoteInput] = useState("");
  const [showNoteFor, setShowNoteFor] = useState(null); // { empId, dateStr }

  const handleCellClick = (empId, dateStr) => {
    if (!canModify(empId) || !isTodayOrFuture(dateStr)) return;
    setEditing({ empId, dateStr });
  };

  const handleSelect = async (newStatus) => {
    const { empId, dateStr } = editing;
    setEditing(null);
    if (newStatus === "RESET") {
      const key = `${empId}::${dateStr}`;
      const record = statusMap[key];
      if (record) await onStatusChange("delete", record.id, empId, dateStr);
      return;
    }
    if (newStatus === "OUTSIDE_OFFICE") {
      setShowNoteFor({ empId, dateStr });
      return;
    }
    await onStatusChange("set", null, empId, dateStr, newStatus, null);
  };

  const handleNoteSubmit = async () => {
    const { empId, dateStr } = showNoteFor;
    setShowNoteFor(null);
    await onStatusChange("set", null, empId, dateStr, "OUTSIDE_OFFICE", noteInput);
    setNoteInput("");
  };

  // Only show first 15 employees in week view to keep it manageable
  const displayEmployees = employees.slice(0, 30);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-48 sticky left-0 bg-gray-50 z-10">
                Employee
              </th>
              {weekDates.map((date) => {
                const dateStr = formatDate(date);
                const isToday = dateStr === today;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th
                    key={dateStr}
                    className={`text-center px-2 py-3 font-medium min-w-[90px] ${
                      isToday
                        ? "bg-blue-50 text-blue-700"
                        : isWeekend
                        ? "text-gray-400"
                        : "text-gray-600"
                    }`}
                  >
                    <div className="text-xs font-semibold">{DAY_NAMES[date.getDay()]}</div>
                    <div className={`text-lg font-bold ${isToday ? "text-blue-600" : ""}`}>
                      {date.getDate()}
                    </div>
                    {isToday && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-0.5" />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayEmployees.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-2 sticky left-0 bg-white border-r border-gray-100 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                      {emp.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[130px]">
                        {emp.id === user?.id ? `${emp.name} ★` : emp.name}
                      </div>
                    </div>
                  </div>
                </td>
                {weekDates.map((date) => {
                  const dateStr = formatDate(date);
                  const key = `${emp.id}::${dateStr}`;
                  const record = statusMap[key];
                  const status = record?.status || "WFO";
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WFO;
                  const Icon = cfg.icon;
                  const editable = canModify(emp.id) && isTodayOrFuture(dateStr);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isEditingThis =
                    editing?.empId === emp.id && editing?.dateStr === dateStr;

                  return (
                    <td
                      key={dateStr}
                      className={`text-center px-1 py-2 relative ${
                        isWeekend ? "bg-gray-50/50" : ""
                      }`}
                    >
                      <button
                        onClick={() => handleCellClick(emp.id, dateStr)}
                        disabled={!editable || saving}
                        title={editable ? "Click to change" : record?.note || cfg.fullLabel}
                        className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                          editable ? "cursor-pointer hover:bg-gray-100" : "cursor-default"
                        }`}
                      >
                        <Icon size={14} className={cfg.iconColor} />
                        <span className={`text-xs font-medium ${cfg.iconColor}`}>
                          {cfg.label}
                        </span>
                      </button>

                      {/* Picker */}
                      {isEditingThis && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50">
                          <StatusPicker
                            currentStatus={status}
                            onSelect={handleSelect}
                            onCancel={() => setEditing(null)}
                            canReset={!!record}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Note input modal */}
      {showNoteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="font-semibold text-gray-800 mb-1">Outside Office</h3>
            <p className="text-sm text-gray-500 mb-3">Add a note (optional)</p>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Client visit, field work"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNoteSubmit();
                if (e.key === "Escape") { setShowNoteFor(null); setNoteInput(""); }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNoteFor(null); setNoteInput(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleNoteSubmit}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {employees.length > 30 && (
        <div className="p-3 text-center text-sm text-gray-500 border-t border-gray-100">
          Showing first 30 of {employees.length} employees. Use entity filter to narrow down.
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkStatusDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("today"); // "today" | "week"

  // Data
  const [employees, setEmployees] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // "empId::YYYY-MM-DD" → record
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Dates
  const [todayStr] = useState(() => formatDate(new Date()));
  const [weekOffset, setWeekOffset] = useState(0); // weeks from current
  const weekDates = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [weekOffset]);

  // Entity filter
  const [entityFilter, setEntityFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let params = {};
      if (tab === "today") {
        params.date = todayStr;
      } else {
        params.startDate = formatDate(weekDates[0]);
        params.endDate = formatDate(weekDates[6]);
      }

      const data = await getWorkStatuses(params);

      setEmployees(data.employees || []);

      // Build status map
      const map = {};
      for (const s of data.statuses || []) {
        const dateStr = new Date(s.date).toISOString().split("T")[0];
        map[`${s.employeeId}::${dateStr}`] = s;
      }
      setStatusMap(map);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, todayStr, weekDates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (action, id, empId, dateStr, status, note) => {
    setSaving(true);
    try {
      if (action === "delete") {
        await deleteWorkStatus(id);
        setStatusMap((prev) => {
          const next = { ...prev };
          delete next[`${empId}::${dateStr}`];
          return next;
        });
      } else {
        const result = await setWorkStatus({
          employeeId: empId,
          date: dateStr,
          status,
          note,
        });
        const record = result.data;
        const key = `${empId}::${new Date(record.date).toISOString().split("T")[0]}`;
        setStatusMap((prev) => ({ ...prev, [key]: record }));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  // Entity list for filter
  const entities = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const emp of employees) {
      const name = emp.plottingCompany?.name;
      if (name && !seen.has(name)) {
        seen.add(name);
        list.push({ id: emp.plottingCompany.id, name });
      }
    }
    return list;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (entityFilter === "all") return employees;
    return employees.filter((e) => e.plottingCompany?.id === entityFilter);
  }, [employees, entityFilter]);

  // Date display
  const todayDisplay = useMemo(() => {
    const d = new Date();
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const weekDisplay = useMemo(() => {
    if (!weekDates.length) return "";
    const start = weekDates[0];
    const end = weekDates[6];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
  }, [weekDates]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Work Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track daily attendance — WFO, WFH, Leave, Outside Office
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Tabs */}
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 gap-1">
            <button
              onClick={() => setTab("today")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === "today"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTab("week")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === "week"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              This Week
            </button>
          </div>

          {/* Date/week label */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2">
            {tab === "today" && <span>{todayDisplay}</span>}
            {tab === "week" && (
              <>
                <button
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="p-0.5 hover:text-gray-900 rounded"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{weekDisplay}</span>
                <button
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-0.5 hover:text-gray-900 rounded"
                >
                  <ChevronRight size={16} />
                </button>
                {weekOffset !== 0 && (
                  <button
                    onClick={() => setWeekOffset(0)}
                    className="text-xs text-blue-600 hover:underline ml-1"
                  >
                    Current week
                  </button>
                )}
              </>
            )}
          </div>

          {/* Entity filter */}
          {entities.length > 1 && (
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Entities</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="ml-auto p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="mb-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 w-fit">
            <RefreshCw size={14} className="animate-spin" />
            Saving...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-white border border-gray-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            {tab === "today" && (
              <TodayView
                user={user}
                employees={filteredEmployees}
                statuses={[]}
                statusMap={statusMap}
                todayStr={todayStr}
                onStatusChange={handleStatusChange}
                saving={saving}
              />
            )}
            {tab === "week" && (
              <WeekView
                user={user}
                employees={filteredEmployees}
                statuses={[]}
                statusMap={statusMap}
                weekDates={weekDates}
                onStatusChange={handleStatusChange}
                saving={saving}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
