// frontend/src/pages/WorkStatusDashboard.jsx
// Work Status / Attendance tracking — WFO/WFH/LEAVE/OUTSIDE_OFFICE

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../hooks/useAuth";
import {
  getWorkStatuses,
  setWorkStatus,
  deleteWorkStatus,
  getWorkStatusDefault,
  setWorkStatusDefault,
  deleteWorkStatusDefault,
  getMyCalendarStatuses,
  getHolidays,
} from "../api/client";
import {
  Building2, Monitor, MapPin, CalendarOff, PowerOff,
  ChevronLeft, ChevronRight, RefreshCw,
  Check, X, Edit3, Calendar, Users,
  Filter, Search, ChevronDown,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  WFO:            { label: "WFO",     fullLabel: "Work From Office",  color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500", icon: Building2,  iconColor: "text-emerald-600" },
  WFH:            { label: "WFH",     fullLabel: "Work From Home",    color: "bg-blue-100 text-blue-800 border-blue-200",           dot: "bg-blue-500",    icon: Monitor,    iconColor: "text-blue-600"    },
  OUTSIDE_OFFICE: { label: "Outside", fullLabel: "Outside Office",    color: "bg-purple-100 text-purple-800 border-purple-200",     dot: "bg-purple-500",  icon: MapPin,     iconColor: "text-purple-600"  },
  LEAVE:          { label: "Leave",   fullLabel: "On Leave",          color: "bg-orange-100 text-orange-800 border-orange-200",     dot: "bg-orange-500",  icon: CalendarOff,iconColor: "text-orange-600"  },
  OFF:            { label: "Off",     fullLabel: "Day Off",           color: "bg-red-50 text-red-400 border-red-100",               dot: "bg-red-300",     icon: PowerOff,   iconColor: "text-red-400"     },
};

const PICKER_STATUSES = ["WFO", "WFH", "OUTSIDE_OFFICE", "LEAVE"];

const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BOD_ROLE = "Board of Director";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isTodayOrFuture(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr+"T00:00:00"); target.setHours(0,0,0,0);
  return target >= today;
}

function isWeekendDate(dateStr) {
  const d = new Date(dateStr+"T00:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function isHolidayDate(dateStr, holidays) {
  return !!holidays?.[dateStr];
}

function getWeekDates(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({length:7}, (_,i) => { const nd = new Date(monday); nd.setDate(monday.getDate()+i); return nd; });
}

function getMonthDates(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let i = startOffset-1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length-1].date;
    const next = new Date(last); next.setDate(last.getDate()+1);
    days.push({ date: next, isCurrentMonth: false });
  }
  return days;
}

/**
 * Effective display status.
 * - Explicit record wins always.
 * - Weekend or holiday → "OFF" when no record.
 * - Otherwise → defaultRec.status or "WFO".
 */
function effectiveStatus(rec, defaultRec, dateStr, holidays = {}) {
  if (rec?.status) return rec.status;
  if (isWeekendDate(dateStr) || holidays[dateStr]) return "OFF";
  return defaultRec?.status || "WFO";
}

// ─── Entity Filter Dropdown ───────────────────────────────────────────────────

function EntityFilterDropdown({ entities, value, onChange }) {
  // value = { mode: 'include'|'exclude', ids: string[] }
  const [open, setOpen]         = useState(false);
  const [localMode, setLocalMode] = useState("include");
  const [localIds, setLocalIds]  = useState(new Set());
  const [search, setSearch]      = useState("");
  const ref = useRef(null);

  // Sync local state when value prop changes
  useEffect(() => {
    setLocalMode(value.mode || "include");
    setLocalIds(new Set(value.ids || []));
  }, [value.mode, value.ids]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [open]);

  const filtered = useMemo(() =>
    entities.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase())),
    [entities, search]
  );

  const toggleId = (id) => {
    setLocalIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const apply = () => { onChange({ mode: localMode, ids: [...localIds] }); setOpen(false); };
  const clear  = () => { setLocalIds(new Set()); onChange({ mode: localMode, ids: [] }); setOpen(false); };

  const activeCount = (value.ids || []).length;
  const label = activeCount === 0
    ? "All Entities"
    : value.mode === "include"
      ? `${activeCount} entit${activeCount > 1 ? "ies" : "y"}`
      : `Excl. ${activeCount}`;

  if (entities.length === 0) return null; // hide when no entities to filter

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-colors ${
          activeCount > 0
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}>
        <Filter size={13} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{activeCount > 0 ? activeCount : ""}<Filter size={13}/></span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-64 p-2">
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg mb-2">
            {["include","exclude"].map(m => (
              <button key={m} onClick={() => setLocalMode(m)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                  localMode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}>
                {m === "include" ? "Show Only" : "Exclude"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search entity..."
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus />
          </div>

          {/* Entity list */}
          <div className="max-h-44 overflow-y-auto space-y-0.5 mb-2">
            {filtered.map(e => (
              <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={localIds.has(e.id)} onChange={() => toggleId(e.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
                <span className="text-sm text-gray-700 truncate">{e.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-3">No entities found</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 pt-2 border-t border-gray-100">
            <button onClick={clear} className="flex-1 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">Clear</button>
            <button onClick={apply} className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WFO;
  const Icon = cfg.icon;
  const sz = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${cfg.color} ${sz}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function StatusPicker({ currentStatus, onSelect, onCancel, canReset }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onCancel();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onCancel]);

  return (
    <div ref={ref} className="flex flex-col gap-0.5 p-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[175px]">
      {PICKER_STATUSES.map((key) => {
        const cfg = STATUS_CONFIG[key];
        const Icon = cfg.icon;
        const isActive = currentStatus === key;
        return (
          <button key={key} onMouseDown={(e) => { e.stopPropagation(); onSelect(key); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${isActive ? "bg-gray-100 ring-1 ring-gray-300" : "hover:bg-gray-50"}`}>
            <Icon size={14} className={cfg.iconColor} />
            {cfg.fullLabel}
            {isActive && <Check size={12} className="ml-auto text-gray-500" />}
          </button>
        );
      })}
      {canReset && (
        <button onMouseDown={(e) => { e.stopPropagation(); onSelect("RESET"); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-0.5">
          <X size={11} />Reset to default
        </button>
      )}
    </div>
  );
}

function NoteModal({ onSubmit, onCancel }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-80" onMouseDown={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800 mb-1">Outside Office</h3>
        <p className="text-sm text-gray-500 mb-3">Add a note (optional)</p>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. Client visit, field work"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
          onKeyDown={e => { if (e.key === "Enter") onSubmit(note); if (e.key === "Escape") onCancel(); }}
          autoFocus />
        <div className="flex gap-2 justify-end">
          <button onMouseDown={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onMouseDown={() => onSubmit(note)} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Default Status Badge (compact, for admin in team views) ────────────────

/**
 * Compact badge for admins to view/edit an employee's default status.
 * Renders nothing for non-admins.
 *
 * Uses React Portal so the picker renders at document.body — escaping any
 * overflow:hidden container or sticky-cell stacking context that would clip
 * or bury it.  Position is calculated via getBoundingClientRect() and the
 * picker flips upward when there is insufficient space below the trigger.
 */
function DefaultStatusBadge({ employeeId, defaultRec, user, onChange }) {
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [pickerStyle, setPickerStyle] = useState({});
  const triggerRef = useRef(null);

  if (!user || user.accessLevel > 2) return null; // admin only

  const defStatus = defaultRec?.status || "WFO";
  const cfg = STATUS_CONFIG[defStatus] || STATUS_CONFIG.WFO;

  const openPicker = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const PICKER_H = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const style = spaceBelow >= PICKER_H
        ? { position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 9999 }
        : { position: "fixed", bottom: window.innerHeight - rect.top + 4, left: rect.left, zIndex: 9999 };
      setPickerStyle(style);
    }
    setEditing(true);
  };

  const handleSelect = async (newStatus) => {
    setEditing(false);
    if (newStatus === "RESET") {
      setSaving(true);
      try { await deleteWorkStatusDefault(employeeId); onChange?.(employeeId, null); } finally { setSaving(false); }
      return;
    }
    setSaving(true);
    try {
      const res = await setWorkStatusDefault({ employeeId, status: newStatus });
      onChange?.(employeeId, res.data);
    } finally { setSaving(false); }
  };

  return (
    <div className="inline-flex items-center gap-1 mt-0.5">
      <span className="text-xs text-gray-400">Dflt:</span>
      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.color}`}>{cfg.label}</span>
      <button ref={triggerRef} onClick={openPicker} disabled={saving}
        className="p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors">
        {saving ? <RefreshCw size={9} className="animate-spin"/> : <Edit3 size={9}/>}
      </button>
      {editing && createPortal(
        <div style={pickerStyle}>
          <StatusPicker currentStatus={defStatus} onSelect={handleSelect}
            onCancel={() => setEditing(false)} canReset={!!defaultRec} />
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Default Status Card ──────────────────────────────────────────────────────

function DefaultStatusCard({ user, employeeId, defaultRec, onDefaultChange }) {
  const [editing, setEditing] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const status = defaultRec?.status || "WFO";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.WFO;
  const Icon = cfg.icon;
  const canEdit = user?.accessLevel <= 2 || user?.id === employeeId;

  const handleSelect = async (newStatus) => {
    setEditing(false);
    if (newStatus === "RESET") {
      setSaving(true);
      try { await deleteWorkStatusDefault(employeeId); onDefaultChange(null); } finally { setSaving(false); }
      return;
    }
    if (newStatus === "OUTSIDE_OFFICE") { setNoteModal(true); return; }
    setSaving(true);
    try { const res = await setWorkStatusDefault({ employeeId, status: newStatus }); onDefaultChange(res.data); } finally { setSaving(false); }
  };

  const handleNoteSubmit = async (note) => {
    setNoteModal(false); setSaving(true);
    try { const res = await setWorkStatusDefault({ employeeId, status: "OUTSIDE_OFFICE", note }); onDefaultChange(res.data); } finally { setSaving(false); }
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.color} relative`}>
      <Icon size={16} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold opacity-70">Default status (today & all future)</div>
        <div className="text-sm font-bold">{cfg.fullLabel}</div>
        {defaultRec?.note && <div className="text-xs opacity-70 truncate">{defaultRec.note}</div>}
      </div>
      {canEdit && (
        <button onClick={() => setEditing(!editing)} disabled={saving}
          className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Edit3 size={13} />}
        </button>
      )}
      {editing && (
        <div className="absolute right-0 top-full mt-1 z-50">
          <StatusPicker currentStatus={status} onSelect={handleSelect} onCancel={() => setEditing(false)} canReset={!!defaultRec} />
        </div>
      )}
      {noteModal && <NoteModal onSubmit={handleNoteSubmit} onCancel={() => setNoteModal(false)} />}
    </div>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ summary, bodSummary, dateLabel }) {
  const total = Object.values(summary).reduce((a,b) => a+b, 0);
  const bodTotal = Object.values(bodSummary || {}).reduce((a,b) => a+b, 0);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Attendance Summary</span>
        <span className="text-xs text-gray-400">{dateLabel} · {total} employees</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {["WFO","WFH","OUTSIDE_OFFICE","LEAVE"].map(key => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const count = summary[key] || 0;
          const pct = total > 0 ? Math.round((count/total)*100) : 0;
          return (
            <div key={key} className={`rounded-xl border p-3 flex items-center gap-2.5 ${cfg.color}`}>
              <div className="p-1.5 rounded-lg bg-white/60"><Icon size={15}/></div>
              <div>
                <div className="text-xl font-bold leading-none">{count}</div>
                <div className="text-xs font-medium opacity-80">{cfg.label} <span className="opacity-60">({pct}%)</span></div>
              </div>
            </div>
          );
        })}
      </div>
      {bodTotal > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
          <span className="font-semibold">BOD:</span>
          {Object.entries(bodSummary).filter(([,v]) => v>0).map(([k,v]) => (
            <span key={k}>{v} {STATUS_CONFIG[k]?.label || k}</span>
          )).reduce((acc,el,i) => [...acc, i>0?<span key={`s${i}`} className="opacity-40">·</span>:null, el], [])}
        </div>
      )}
    </div>
  );
}

// ─── Employee Row (today view) ────────────────────────────────────────────────

function EmployeeRow({ emp, user, dateStr, record, defaultRec, onStatusChange, saving, isBod, holidays, onDefaultChange }) {
  const [editing, setEditing] = useState(false);
  const [noteModal, setNoteModal] = useState(false);

  const isWknd    = isWeekendDate(dateStr);
  const isHoliday = isHolidayDate(dateStr, holidays);
  const holidayName   = holidays?.[dateStr];
  const isNonWorking  = isWknd || isHoliday;

  const eff = effectiveStatus(record, defaultRec, dateStr, holidays);
  const isDefaulting = !record?.status;
  const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.WFO;

  // L1/L2 admins can edit anything (weekends, holidays included).
  // L3+ are blocked on non-working days.
  const canModify = !user ? false
    : user.accessLevel <= 2 ? true
    : isNonWorking ? false                             // L3+ blocked on weekends/holidays
    : (user.id === emp.id || user.accessLevel <= 4);  // self or in-scope
  const editable = canModify && isTodayOrFuture(dateStr);

  const handleSelect = (newStatus) => {
    // Extra guard: L3+ must not be able to reach here on non-working days
    if (isNonWorking && user?.accessLevel > 2) { setEditing(false); return; }
    setEditing(false);
    if (newStatus === "OUTSIDE_OFFICE") { setNoteModal(true); return; }
    if (newStatus === "RESET") {
      if (record) onStatusChange("delete", record.id, emp.id, dateStr);
      return;
    }
    onStatusChange("set", null, emp.id, dateStr, newStatus, null);
  };

  return (
    <div className={`relative ${isBod ? "bg-amber-50/60" : ""} ${isNonWorking ? "bg-red-50/40" : ""}`}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        {isBod && <span className="w-1 h-6 rounded-full bg-amber-400 flex-shrink-0" />}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isBod?"bg-amber-200 text-amber-800":"bg-gray-200 text-gray-600"}`}>
          {emp.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
            {emp.id === user?.id ? `${emp.name} (You)` : emp.name}
            {isBod && <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">BOD</span>}
          </div>
          <div className="text-xs text-gray-500 truncate">{emp.role?.name || emp.division?.name}</div>
          {holidayName && <div className="text-xs text-red-400 truncate">🎌 {holidayName}</div>}
          {/* Admin: compact default status editor */}
          <DefaultStatusBadge employeeId={emp.id} defaultRec={defaultRec} user={user} onChange={onDefaultChange} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={eff} />
          {isDefaulting && !isNonWorking && <span className="text-xs text-gray-400 italic">default</span>}
          {record?.note && <span className="text-xs text-gray-400 italic truncate max-w-[90px]" title={record.note}>{record.note}</span>}
          {editable && (
            <button onClick={() => setEditing(!editing)} disabled={saving}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Edit3 size={13}/>
            </button>
          )}
        </div>
      </div>
      {editing && editable && (
        <div className="absolute right-4 top-full mt-0.5 z-50">
          <StatusPicker currentStatus={eff} onSelect={handleSelect} onCancel={() => setEditing(false)} canReset={!!record} />
        </div>
      )}
      {noteModal && (
        <NoteModal onSubmit={(note) => { setNoteModal(false); onStatusChange("set",null,emp.id,dateStr,"OUTSIDE_OFFICE",note); }}
          onCancel={() => setNoteModal(false)} />
      )}
    </div>
  );
}

// ─── Today / Date View ────────────────────────────────────────────────────────

function TodayView({ user, employees, statusMap, defaultMap, dateStr, onStatusChange, saving,
                     summary, bodSummary, page, totalPages, onPageChange, holidays, onDefaultChange }) {
  const bod     = employees.filter(e => e.role?.name === BOD_ROLE);
  const regular = employees.filter(e => e.role?.name !== BOD_ROLE);
  const d = new Date(dateStr+"T00:00:00");
  const dateLabel = `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div className="space-y-4">
      <SummaryBar summary={summary} bodSummary={bodSummary} dateLabel={dateLabel} />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {bod.length > 0 && (
          <>
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Board of Directors</span>
              <span className="text-xs text-amber-500">({bod.length})</span>
            </div>
            <div className="divide-y divide-amber-50/80 border-b border-gray-100">
              {bod.map(emp => (
                <EmployeeRow key={emp.id} emp={emp} user={user}
                  dateStr={dateStr} record={statusMap[`${emp.id}::${dateStr}`]}
                  defaultRec={defaultMap[emp.id]} onStatusChange={onStatusChange}
                  saving={saving} isBod holidays={holidays} onDefaultChange={onDefaultChange} />
              ))}
            </div>
          </>
        )}
        <div className="divide-y divide-gray-100">
          {regular.map(emp => (
            <EmployeeRow key={emp.id} emp={emp} user={user}
              dateStr={dateStr} record={statusMap[`${emp.id}::${dateStr}`]}
              defaultRec={defaultMap[emp.id]} onStatusChange={onStatusChange}
              saving={saving} isBod={false} holidays={holidays} onDefaultChange={onDefaultChange} />
          ))}
        </div>
        {employees.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            <Users size={36} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No team members to display</p>
          </div>
        )}
        {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange}/>}
      </div>
    </div>
  );
}

function PaginationBar({ page, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
      <button onClick={() => onPageChange(page-1)} disabled={page<=1}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-white border border-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
        <ChevronLeft size={14}/> Prev
      </button>
      <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
      <button onClick={() => onPageChange(page+1)} disabled={page>=totalPages}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-white border border-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
        Next <ChevronRight size={14}/>
      </button>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ user, employees, statusMap, defaultMap, weekDates, onStatusChange, saving,
                    page, totalPages, onPageChange, holidays, weekDaySummary, onDefaultChange }) {
  const today = formatDate(new Date());
  const [editing, setEditing]       = useState(null); // { empId, dateStr }
  const [pickerStyle, setPickerStyle] = useState({});
  const [noteModal, setNoteModal]   = useState(null);

  // Who can modify a specific cell
  const canModify = (empId, dateStr) => {
    if (!user) return false;
    if (user.accessLevel <= 2) return true;          // admins: anything
    if (isWeekendDate(dateStr)) return false;         // L3+: no weekends
    if (holidays?.[dateStr]) return false;            // L3+: no holidays
    if (user.id === empId) return true;               // can edit self
    if (user.accessLevel <= 4) return true;           // L3/L4: can edit others
    return false;
  };

  const handleCellClick = (empId, dateStr, e) => {
    if (user?.accessLevel > 2 && isWeekendDate(dateStr)) return;
    if (user?.accessLevel > 2 && holidays?.[dateStr]) return;
    if (!canModify(empId, dateStr) || !isTodayOrFuture(dateStr)) return;

    // Toggle off if clicking same cell again
    if (editing?.empId === empId && editing?.dateStr === dateStr) {
      setEditing(null); return;
    }

    // Calculate portal position from the clicked button
    if (e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      const PICKER_W = 185;
      const PICKER_H = 200;
      let   left = rect.left + rect.width / 2 - PICKER_W / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - PICKER_W - 8));
      const spaceBelow = window.innerHeight - rect.bottom;
      const style = spaceBelow >= PICKER_H
        ? { position: "fixed", top: rect.bottom + 4, left, zIndex: 9999 }
        : { position: "fixed", bottom: window.innerHeight - rect.top + 4, left, zIndex: 9999 };
      setPickerStyle(style);
    }
    setEditing({ empId, dateStr });
  };

  const handleSelect = (newStatus) => {
    const { empId, dateStr } = editing;
    setEditing(null);
    if (newStatus === "OUTSIDE_OFFICE") { setNoteModal({ empId, dateStr }); return; }
    if (newStatus === "RESET") {
      const rec = statusMap[`${empId}::${dateStr}`];
      if (rec) onStatusChange("delete", rec.id, empId, dateStr);
      return;
    }
    onStatusChange("set", null, empId, dateStr, newStatus, null);
  };

  // Derived editing state for portal picker
  const editingRec = editing ? statusMap[`${editing.empId}::${editing.dateStr}`] : null;
  const editingEff = editing
    ? effectiveStatus(editingRec, defaultMap[editing.empId], editing.dateStr, holidays)
    : null;

  const bod     = employees.filter(e => e.role?.name === BOD_ROLE);
  const regular = employees.filter(e => e.role?.name !== BOD_ROLE);
  const ordered = [...bod, ...regular];

  // Week summary: use server-provided weekDaySummary if available;
  // otherwise compute client-side from current page only (fallback)
  const weekSummary = useMemo(() => {
    return weekDates.map(date => {
      const ds = formatDate(date);
      const isWknd = date.getDay()===0||date.getDay()===6;
      const isHoliday = !!holidays?.[ds];
      const isOff = isWknd || isHoliday;
      if (isOff) return { ds, isOff: true, isWknd, isHoliday, holidayName: holidays?.[ds], counts: {} };
      // Use backend summary if available
      if (weekDaySummary?.[ds]) return { ds, isOff: false, isWknd, isHoliday, counts: weekDaySummary[ds] };
      // Fallback: client-side from current page employees
      const counts = { WFO:0, WFH:0, OUTSIDE_OFFICE:0, LEAVE:0 };
      employees.forEach(emp => {
        const rec = statusMap[`${emp.id}::${ds}`];
        const def = defaultMap[emp.id]?.status || "WFO";
        const s   = rec?.status || def;
        counts[s] = (counts[s]||0) + 1;
      });
      return { ds, isOff: false, isWknd, isHoliday, counts };
    });
  }, [weekDates, employees, statusMap, defaultMap, holidays, weekDaySummary]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-48 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Employee</th>
                {weekDates.map(date => {
                  const ds = formatDate(date);
                  const isToday = ds === today;
                  const isWk = date.getDay()===0||date.getDay()===6;
                  const isHoliday = !!holidays?.[ds];
                  const holidayName = holidays?.[ds];
                  const isOff = isWk || isHoliday;
                  return (
                    <th key={ds} className={`text-center px-2 py-2 font-medium min-w-[88px] ${isToday?"bg-blue-50 text-blue-700":isOff?"bg-red-50/60 text-red-400":"text-gray-600"}`}>
                      <div className="text-xs font-semibold">{DAY_NAMES[date.getDay()]}</div>
                      <div className={`text-base font-bold ${isToday?"text-blue-600":isOff?"text-red-400":""}`}>{date.getDate()}</div>
                      {isToday && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-0.5"/>}
                      {isWk && !isHoliday && <div className="text-xs opacity-50">Off</div>}
                      {isHoliday && (
                        <div className="text-xs text-red-400 font-normal truncate max-w-[80px] mx-auto" title={holidayName}>
                          🎌 <span className="truncate">{holidayName}</span>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.map((emp, idx) => {
                const isBod = emp.role?.name === BOD_ROLE;
                return (
                  <React.Fragment key={emp.id}>
                    {isBod && idx === 0 && (
                      <tr><td colSpan={8} className="px-4 py-1.5 bg-amber-50 border-y border-amber-100">
                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Board of Directors</span>
                      </td></tr>
                    )}
                    {!isBod && idx === bod.length && bod.length > 0 && (
                      <tr><td colSpan={8} className="px-4 py-1.5 bg-gray-50 border-y border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employees</span>
                      </td></tr>
                    )}
                    <tr className={`border-b border-gray-100 hover:bg-gray-50/50 ${isBod?"bg-amber-50/30":""}`}>
                      <td className="px-4 py-2 sticky left-0 border-r border-gray-100 z-10 bg-inherit">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isBod?"bg-amber-200 text-amber-800":"bg-gray-200 text-gray-600"}`}>
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[110px]">
                              {emp.id===user?.id?`${emp.name} ★`:emp.name}
                              {isBod&&<span className="ml-1 text-xs text-amber-600 font-semibold">BOD</span>}
                            </div>
                            {/* Admin default status editor */}
                            <DefaultStatusBadge employeeId={emp.id} defaultRec={defaultMap[emp.id]}
                              user={user} onChange={onDefaultChange} />
                          </div>
                        </div>
                      </td>
                      {weekDates.map(date => {
                        const ds = formatDate(date);
                        const key = `${emp.id}::${ds}`;
                        const rec = statusMap[key];
                        const isWknd = date.getDay()===0||date.getDay()===6;
                        const isHoliday = !!holidays?.[ds];
                        const isOff = isWknd || isHoliday;
                        const eff = effectiveStatus(rec, defaultMap[emp.id], ds, holidays);
                        const isDefaulting = !rec?.status;
                        const cfg = STATUS_CONFIG[eff]||STATUS_CONFIG.WFO;
                        const Icon = cfg.icon;
                        const editable = canModify(emp.id,ds) && isTodayOrFuture(ds);
                        const isEditingThis = editing?.empId===emp.id&&editing?.dateStr===ds;

                        return (
                          <td key={ds} className={`text-center px-1 py-1.5 ${isOff?"bg-red-50/40":""} ${isEditingThis?"bg-blue-50/30":""}`}>
                            <button
                              type="button"
                              onClick={(e) => handleCellClick(emp.id, ds, e)}
                              disabled={!editable || saving}
                              title={isWknd?"Weekend":isHoliday?(holidays[ds]||"Public Holiday"):(isDefaulting?"Default: "+cfg.fullLabel:(rec?.note||cfg.fullLabel))}
                              className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors w-full
                                ${editable ? "cursor-pointer hover:bg-gray-100" : "cursor-default pointer-events-none"}
                                ${isDefaulting && !isOff ? "opacity-60" : ""}
                                ${isEditingThis ? "ring-2 ring-blue-400 ring-inset" : ""}
                              `}
                            >
                              <Icon size={13} className={cfg.iconColor}/>
                              <span className={`text-xs font-medium ${cfg.iconColor}`}>{cfg.label}</span>
                            </button>
                            {/* Picker is rendered via portal below — not inline in td */}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Summary footer — uses server-side weekDaySummary for full accuracy */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50 border-r border-gray-200 uppercase tracking-wide">
                  Summary {weekDaySummary ? "" : <span className="text-gray-400 font-normal normal-case">(page only)</span>}
                </td>
                {weekSummary.map(({ ds, isOff, holidayName, counts }) => (
                  <td key={ds} className={`px-1 py-2 text-center ${isOff?"bg-red-50/40":""}`}>
                    {isOff ? (
                      <span className="text-xs text-red-300 font-medium">{holidayName ? "Holiday" : "Weekend"}</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 items-center">
                        {["WFO","WFH","OUTSIDE_OFFICE","LEAVE"].filter(k => counts[k]>0).map(k => {
                          const cfg = STATUS_CONFIG[k];
                          return (
                            <span key={k} className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cfg.color}`}>
                              {cfg.label} {counts[k]}
                            </span>
                          );
                        })}
                        {["WFO","WFH","OUTSIDE_OFFICE","LEAVE"].every(k => !counts[k]) && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange}/>}
      </div>

      {/* Portal-rendered cell status picker — outside overflow:hidden and sticky stacking contexts */}
      {editing && editingEff !== null && createPortal(
        <div style={pickerStyle}>
          <StatusPicker currentStatus={editingEff} onSelect={handleSelect}
            onCancel={() => setEditing(null)} canReset={!!editingRec} />
        </div>,
        document.body
      )}

      {noteModal && (
        <NoteModal onSubmit={(note) => {
          const {empId,dateStr} = noteModal; setNoteModal(null);
          onStatusChange("set",null,empId,dateStr,"OUTSIDE_OFFICE",note);
        }} onCancel={() => setNoteModal(null)} />
      )}
    </div>
  );
}

// ─── My Calendar View ─────────────────────────────────────────────────────────

function MyCalendarView({ user, holidays }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [calStatusMap, setCalStatusMap] = useState({});
  const [defaultRec, setDefaultRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);      // dateStr
  const [pickerStyle, setPickerStyle] = useState({});
  const [noteModal, setNoteModal] = useState(null);

  const viewMonth     = ((today.getMonth() + monthOffset) % 12 + 12) % 12;
  const viewYearShift = Math.floor((today.getMonth() + monthOffset) / 12);
  const viewYear      = today.getFullYear() + viewYearShift;

  const monthDays = useMemo(() => getMonthDates(viewYear, viewMonth), [viewYear, viewMonth]);

  const fetchCalData = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay  = new Date(viewYear, viewMonth+1, 0);
      const [calData, defData] = await Promise.all([
        getMyCalendarStatuses({ startDate: formatDate(firstDay), endDate: formatDate(lastDay) }),
        getWorkStatusDefault(),
      ]);
      const map = {};
      for (const s of calData.statuses || []) {
        const ds = new Date(s.date).toISOString().split("T")[0];
        map[ds] = s;
      }
      setCalStatusMap(map);
      setDefaultRec(defData.data || null);
    } catch (err) {
      console.error("Calendar fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchCalData(); }, [fetchCalData]);

  const todayStr = formatDate(today);

  const handleSelect = async (newStatus, dateStr) => {
    setEditing(null);
    if (newStatus === "OUTSIDE_OFFICE") { setNoteModal(dateStr); return; }
    if (newStatus === "RESET") {
      const rec = calStatusMap[dateStr];
      if (rec) {
        setSaving(true);
        try { await deleteWorkStatus(rec.id); setCalStatusMap(prev => { const n={...prev}; delete n[dateStr]; return n; }); } finally { setSaving(false); }
      }
      return;
    }
    await doSet(dateStr, newStatus, null);
  };

  const doSet = async (dateStr, status, note) => {
    setSaving(true);
    try {
      const res = await setWorkStatus({ employeeId: user.id, date: dateStr, status, note });
      const rec = res.data;
      const ds  = new Date(rec.date).toISOString().split("T")[0];
      setCalStatusMap(prev => ({ ...prev, [ds]: rec }));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <DefaultStatusCard user={user} employeeId={user.id} defaultRec={defaultRec} onDefaultChange={setDefaultRec} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button onClick={() => setMonthOffset(m=>m-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16}/></button>
          <div className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</div>
          <div className="flex items-center gap-1">
            {monthOffset!==0 && <button onClick={() => setMonthOffset(0)} className="text-xs text-blue-600 hover:underline mr-1">Today</button>}
            <button onClick={() => setMonthOffset(m=>m+1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16}/></button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i) => (
            <div key={d} className={`text-center text-xs font-semibold py-2 ${i>=5?"text-red-400":"text-gray-500"}`}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-7">
            {monthDays.map(({date, isCurrentMonth}, idx) => {
              const ds    = formatDate(date);
              const rec   = calStatusMap[ds];
              const isWknd = date.getDay()===0||date.getDay()===6;
              const isHoliday = isHolidayDate(ds, holidays);
              const holidayName = holidays?.[ds];
              const isNonWorking = isWknd || isHoliday;
              const eff   = effectiveStatus(rec, defaultRec, ds, holidays);
              const isDefaulting = !rec?.status;
              const cfg   = STATUS_CONFIG[eff]||STATUS_CONFIG.WFO;
              const isTodayDate = ds === todayStr;
              // Employees (L3+) can't edit weekends or holidays
              const editable = isCurrentMonth && !isNonWorking && isTodayOrFuture(ds);
              const isEditingThis = editing === ds;

              return (
                <div key={idx}
                  className={`min-h-[72px] border-b border-r border-gray-100 p-1.5 transition-colors
                    ${!isCurrentMonth?"bg-gray-50/70":""}
                    ${isTodayDate?"ring-2 ring-inset ring-blue-400":""}
                    ${isNonWorking&&isCurrentMonth?"bg-red-50/40":""}
                    ${isEditingThis?"ring-2 ring-inset ring-blue-300 bg-blue-50/30":""}
                    ${editable?"cursor-pointer hover:bg-blue-50/20":"cursor-default"}
                  `}
                  onClick={(e) => {
                    if (!editable || isEditingThis) return;
                    // Calculate portal position (flip up for bottom rows)
                    const rect = e.currentTarget.getBoundingClientRect();
                    const PICKER_H = 200;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    let   left = rect.left;
                    left = Math.max(8, Math.min(left, window.innerWidth - 193));
                    const style = spaceBelow >= PICKER_H
                      ? { position: "fixed", top: rect.bottom + 2, left, zIndex: 9999 }
                      : { position: "fixed", bottom: window.innerHeight - rect.top + 2, left, zIndex: 9999 };
                    setPickerStyle(style);
                    setEditing(ds);
                  }}
                >
                  <div className={`text-xs font-semibold mb-1 ${isTodayDate?"text-blue-600":isCurrentMonth?isNonWorking?"text-red-400":"text-gray-700":"text-gray-300"}`}>
                    {isTodayDate
                      ? <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 text-white rounded-full text-xs">{date.getDate()}</span>
                      : date.getDate()
                    }
                  </div>
                  {isCurrentMonth && (
                    <div className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${cfg.color} ${isDefaulting?"opacity-60":""}`}>
                      {React.createElement(cfg.icon, {size:10})}
                      {cfg.label}
                    </div>
                  )}
                  {rec?.note && <div className="text-xs text-gray-400 italic truncate mt-0.5">{rec.note}</div>}
                  {isCurrentMonth && holidayName && (
                    <div className="text-xs text-red-400 truncate mt-0.5" title={holidayName}>🎌 {holidayName}</div>
                  )}
                  {/* Picker rendered via portal — see below */}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Portal picker for calendar cells */}
      {editing && createPortal(
        <div style={pickerStyle}>
          <StatusPicker
            currentStatus={effectiveStatus(calStatusMap[editing], defaultRec, editing, holidays)}
            canReset={!!calStatusMap[editing]}
            onSelect={(s) => handleSelect(s, editing)}
            onCancel={() => setEditing(null)} />
        </div>,
        document.body
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center">
        {Object.entries(STATUS_CONFIG).map(([key,cfg]) => {
          const Icon = cfg.icon;
          return <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border ${cfg.color}`}><Icon size={10}/>{cfg.fullLabel}</div>;
        })}
        <span className="text-xs text-gray-400 italic">Faded = default</span>
        <span className="text-xs text-red-400">🎌 = Public holiday</span>
      </div>

      {saving && <div className="flex items-center gap-2 text-sm text-blue-600"><RefreshCw size={13} className="animate-spin"/>Saving...</div>}
      {noteModal && (
        <NoteModal onSubmit={(note) => { const ds=noteModal; setNoteModal(null); doSet(ds,"OUTSIDE_OFFICE",note); }}
          onCancel={() => setNoteModal(null)} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function WorkStatusDashboard() {
  const { user } = useAuth();

  const isAdmin = user?.accessLevel <= 2;

  // Default tab: admins → "today"; employees → "calendar"
  const [tab, setTab] = useState(null);
  const [tabReady, setTabReady] = useState(false);

  useEffect(() => {
    if (user && !tabReady) {
      setTab(isAdmin ? "today" : "calendar");
      setTabReady(true);
    }
  }, [user, isAdmin, tabReady]);

  // Team view state
  const [employees, setEmployees]   = useState([]);
  const [statusMap, setStatusMap]   = useState({});
  const [defaultMap, setDefaultMap] = useState({});
  const [summary, setSummary]       = useState({WFO:0,WFH:0,LEAVE:0,OUTSIDE_OFFICE:0});
  const [bodSummary, setBodSummary] = useState({WFO:0,WFH:0,LEAVE:0,OUTSIDE_OFFICE:0});
  const [weekDaySummary, setWeekDaySummary] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Entity filter
  const [entityFilter, setEntityFilter]       = useState({ mode: "include", ids: [] });
  const [visibleEntities, setVisibleEntities] = useState([]);

  // Indonesian holidays: dateStr → localName
  const [holidays, setHolidays] = useState({});

  // Fetch holidays once on mount (current + next year)
  useEffect(() => {
    const year = new Date().getFullYear();
    Promise.all([
      getHolidays(year).catch(() => ({ data: [] })),
      getHolidays(year + 1).catch(() => ({ data: [] })),
    ]).then(([r1, r2]) => {
      const map = {};
      for (const h of [...(r1.data || []), ...(r2.data || [])]) {
        map[h.date] = h.localName || h.name;
      }
      setHolidays(map);
    });
  }, []);

  const todayStr = useMemo(() => formatDate(new Date()), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => {
    const ref = new Date(); ref.setDate(ref.getDate() + weekOffset*7);
    return getWeekDates(ref);
  }, [weekOffset]);

  const weekDisplay = useMemo(() => {
    if (!weekDates.length) return "";
    const s=weekDates[0], e=weekDates[6];
    if (s.getMonth()===e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`;
    return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
  }, [weekDates]);

  const fetchTeamData = useCallback(async (pageNum=1) => {
    if (!tab || tab === "calendar") return;
    setLoading(true); setError(null);
    try {
      const params = { page: pageNum, pageSize: PAGE_SIZE };
      if (tab === "today") params.date = todayStr;
      else { params.startDate = formatDate(weekDates[0]); params.endDate = formatDate(weekDates[6]); }

      // Entity filter
      if (entityFilter.ids.length > 0) {
        if (entityFilter.mode === "include") params.filterEntityIds = entityFilter.ids.join(",");
        else params.excludeEntityIds = entityFilter.ids.join(",");
      }

      const data = await getWorkStatuses(params);
      setEmployees(data.employees || []);
      setSummary(data.summary || {WFO:0,WFH:0,LEAVE:0,OUTSIDE_OFFICE:0});
      setBodSummary(data.bodSummary || {WFO:0,WFH:0,LEAVE:0,OUTSIDE_OFFICE:0});
      setWeekDaySummary(data.weekDaySummary || null);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
      if (data.visibleEntities?.length) setVisibleEntities(data.visibleEntities);
      const map = {};
      for (const s of data.statuses || []) {
        const ds = new Date(s.date).toISOString().split("T")[0];
        map[`${s.employeeId}::${ds}`] = s;
      }
      setStatusMap(map);
      setDefaultMap(data.defaults || {});
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally { setLoading(false); }
  }, [tab, todayStr, weekDates, entityFilter]);

  // Re-fetch on tab/week change or entity filter change
  useEffect(() => {
    if (tab && tab !== "calendar") { setPage(1); fetchTeamData(1); }
  }, [tab, todayStr, weekOffset, entityFilter]);

  const handlePageChange = (newPage) => { setPage(newPage); fetchTeamData(newPage); };

  /** Called when admin changes an employee's default status from the team view */
  const handleDefaultChange = (empId, newDefault) => {
    setDefaultMap(prev => {
      const next = { ...prev };
      if (newDefault) next[empId] = newDefault;
      else delete next[empId];
      return next;
    });
  };

  const handleStatusChange = async (action, id, empId, dateStr, status, note) => {
    setSaving(true);
    try {
      if (action === "delete") {
        await deleteWorkStatus(id);
        setStatusMap(prev => { const n={...prev}; delete n[`${empId}::${dateStr}`]; return n; });
      } else {
        const res = await setWorkStatus({ employeeId: empId, date: dateStr, status, note });
        const rec = res.data;
        const ds  = new Date(rec.date).toISOString().split("T")[0];
        setStatusMap(prev => ({...prev, [`${empId}::${ds}`]: rec}));
      }
      await fetchTeamData(page);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to update status");
    } finally { setSaving(false); }
  };

  const TABS = [
    { id:"today",    label:"Today",       icon:Building2 },
    { id:"week",     label:"This Week",   icon:Users     },
    ...(!isAdmin ? [{ id:"calendar", label:"My Calendar", icon:Calendar }] : []),
  ];

  if (!tabReady) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Work Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily attendance tracking — WFO, WFH, Leave, Outside Office</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 gap-1">
            {TABS.map(({id, label, icon:Icon}) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${tab===id?"bg-blue-600 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
                <Icon size={14}/>{label}
              </button>
            ))}
          </div>

          {tab === "week" && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <button onClick={() => setWeekOffset(w=>w-1)} className="p-0.5 hover:text-gray-900 rounded"><ChevronLeft size={15}/></button>
              <span className="min-w-[180px] text-center">{weekDisplay}</span>
              <button onClick={() => setWeekOffset(w=>w+1)} className="p-0.5 hover:text-gray-900 rounded"><ChevronRight size={15}/></button>
              {weekOffset!==0 && <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline ml-1">Now</button>}
            </div>
          )}

          {/* Entity filter — shown on today + week tabs */}
          {tab !== "calendar" && visibleEntities.length > 1 && (
            <EntityFilterDropdown
              entities={visibleEntities}
              value={entityFilter}
              onChange={(f) => { setEntityFilter(f); }}
            />
          )}

          {tab !== "calendar" && (
            <button onClick={() => fetchTeamData(page)} disabled={loading}
              className="ml-auto p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
              <RefreshCw size={15} className={loading?"animate-spin":""}/>
            </button>
          )}
        </div>

        {saving && (
          <div className="mb-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 w-fit">
            <RefreshCw size={13} className="animate-spin"/>Saving...
          </div>
        )}
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

        {loading && tab !== "calendar" && (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-white border border-gray-200 rounded-xl animate-pulse"/>)}
          </div>
        )}

        {!loading && tab === "today" && (
          <TodayView user={user} employees={employees} statusMap={statusMap} defaultMap={defaultMap}
            dateStr={todayStr} onStatusChange={handleStatusChange} saving={saving}
            summary={summary} bodSummary={bodSummary} page={page} totalPages={totalPages}
            onPageChange={handlePageChange} holidays={holidays} onDefaultChange={handleDefaultChange} />
        )}
        {!loading && tab === "week" && (
          <WeekView user={user} employees={employees} statusMap={statusMap} defaultMap={defaultMap}
            weekDates={weekDates} onStatusChange={handleStatusChange} saving={saving}
            page={page} totalPages={totalPages} onPageChange={handlePageChange}
            holidays={holidays} weekDaySummary={weekDaySummary} onDefaultChange={handleDefaultChange} />
        )}
        {tab === "calendar" && user && (
          <MyCalendarView user={user} holidays={holidays} />
        )}
      </div>
    </div>
  );
}
