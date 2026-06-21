// frontend/src/pages/WfhAdmin.jsx
// Admin/HR management page for WFH scheduling.
// Tabs: Feature Scopes | Employee Quotas | Weekly Schedule

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import {
  getWfhScopes, addWfhScope, updateWfhScope, deleteWfhScope,
  getWfhQuotas, setWfhQuota, deleteWfhQuota,
  getWfhSchedule, submitWfhSchedule, deleteWfhSchedule,
  getWfhEligibleEmployees,
  getWfhWindowOverride, setWfhWindowOverride,
  addWfhExclusion, removeWfhExclusion,
} from "../api/client";
import {
  Monitor, Building2, Users, Shield, Plus, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, Edit3, Check,
  AlertCircle, ToggleLeft, ToggleRight, Search,
  Lock, Unlock, Clock, UserX, UserCheck,
} from "lucide-react";

const SCOPE_LABELS = {
  ENTITY:   { label: "Entity",   icon: Building2, color: "bg-blue-100 text-blue-700" },
  SUBGROUP: { label: "Subgroup", icon: Users,     color: "bg-indigo-100 text-indigo-700" },
  GROUP:    { label: "Group",    icon: Shield,    color: "bg-purple-100 text-purple-700" },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_SHORT_ALL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function getDayShort(ds) { return DAY_SHORT_ALL[new Date(ds + "T00:00:00").getDay()]; }

function toDateStr(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(ds) {
  const d = new Date(ds + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function getWeekLabel(weekStartDate) {
  if (!weekStartDate) return "";
  const mon = new Date(weekStartDate + "T00:00:00");
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  return `${formatDateLabel(weekStartDate)} – ${formatDateLabel(toDateStr(fri))} ${fri.getFullYear()}`;
}

function addWeeks(weekStr, delta) {
  const d = new Date(weekStr + "T00:00:00");
  d.setDate(d.getDate() + delta * 7);
  return toDateStr(d);
}

function getCurrentWeekStart() {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMonday = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return toDateStr(monday);
}

// ─── Tab: Feature Scopes ──────────────────────────────────────────────────────

function ScopesTab() {
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formScopeType, setFormScopeType] = useState("SUBGROUP");
  const [formScopeId, setFormScopeId] = useState("");
  const [scopeOptions, setScopeOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getWfhScopes().catch(() => ({ data: [] }));
    setScopes(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fetch = async () => {
      const ep = formScopeType === "ENTITY" ? "/plotting-companies"
               : formScopeType === "SUBGROUP" ? "/entity-subgroups"
               : "/entity-groups";
      const res = await apiClient.get(ep).catch(() => ({ data: [] }));
      const items = res.data?.data || res.data || [];
      setScopeOptions(Array.isArray(items) ? items : []);
      setFormScopeId("");
    };
    fetch();
  }, [formScopeType]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formScopeId) return;
    setSubmitting(true);
    try {
      await addWfhScope({ scopeType: formScopeType, scopeId: formScopeId });
      setShowForm(false);
      setFormScopeId("");
      await load();
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (scope) => {
    await updateWfhScope(scope.id, { isActive: !scope.isActive }).catch(() => {});
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this WFH scope?")) return;
    await deleteWfhScope(id).catch(() => {});
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">
            Enable WFH scheduling for specific entities, subgroups, or groups.
            Employees in active scopes see the WFH picker; WFH in Work Status is disabled for them.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          <Plus size={15}/> Add Scope
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              {Object.entries(SCOPE_LABELS).map(([k, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={k} type="button" onClick={() => setFormScopeType(k)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      formScopeType === k ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}>
                    <Icon size={14}/>{cfg.label}
                  </button>
                );
              })}
            </div>
            <select value={formScopeId} onChange={(e) => setFormScopeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
              <option value="">-- Select {SCOPE_LABELS[formScopeType]?.label} --</option>
              {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting || !formScopeId}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "Saving..." : "Add Scope"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : scopes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Monitor size={32} className="mx-auto mb-2 opacity-30"/>
            <p>No scopes configured. Add one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {scopes.map((s) => {
              const cfg = SCOPE_LABELS[s.scopeType] || SCOPE_LABELS.ENTITY;
              const Icon = cfg.icon;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                    <Icon size={10}/>{cfg.label}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 font-medium">{s.scopeId}</span>
                  <button onClick={() => handleToggle(s)} className="text-gray-400 hover:text-blue-500 transition-colors" title="Toggle">
                    {s.isActive ? <ToggleRight size={22} className="text-blue-500"/> : <ToggleLeft size={22}/>}
                  </button>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "Active" : "Disabled"}
                  </span>
                  <button onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Employee Quotas ─────────────────────────────────────────────────────

function QuotasTab() {
  const [employees, setEmployees] = useState([]);
  const [quotas, setQuotas] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // employeeId
  const [editVal, setEditVal] = useState(1);
  const [saving, setSaving] = useState(null);
  const [excludingId, setExcludingId] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, quotaRes] = await Promise.all([
      getWfhEligibleEmployees().catch(() => ({ data: [] })),
      getWfhQuotas().catch(() => ({ data: [] })),
    ]);
    setEmployees(empRes.data || []);
    const qMap = {};
    for (const q of (quotaRes.data || [])) qMap[q.employeeId] = q.quotaPerWeek;
    setQuotas(qMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (empId) => {
    setSaving(empId);
    try {
      await setWfhQuota({ employeeId: empId, quotaPerWeek: editVal });
      setQuotas((prev) => ({ ...prev, [empId]: editVal }));
      setEditing(null);
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (empId) => {
    setSaving(empId);
    try {
      await deleteWfhQuota(empId);
      setQuotas((prev) => { const n = {...prev}; delete n[empId]; return n; });
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setSaving(null);
    }
  };

  const handleExclude = async (empId) => {
    setExcludingId(empId);
    try {
      await addWfhExclusion(empId);
      setEmployees((prev) => prev.map((e) => e.id === empId ? { ...e, isExcluded: true } : e));
    } catch (err) {
      alert(err.message || "Failed to exclude");
    } finally {
      setExcludingId(null);
    }
  };

  const handleInclude = async (empId) => {
    setExcludingId(empId);
    try {
      await removeWfhExclusion(empId);
      setEmployees((prev) => prev.map((e) => e.id === empId ? { ...e, isExcluded: false } : e));
    } catch (err) {
      alert(err.message || "Failed to re-include");
    } finally {
      setExcludingId(null);
    }
  };

  const filtered = employees.filter((e) =>
    !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Default quota is <strong>1 WFH day/week</strong>. Override here for specific employees.
      </p>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No eligible employees found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((emp) => {
              const quota = quotas[emp.id] ?? 1;
              const isEditing = editing === emp.id;
              const isSaving = saving === emp.id;
              const hasOverride = !!quotas[emp.id];
              const isExcluded = emp.isExcluded;
              const isExcluding = excludingId === emp.id;
              return (
                <div key={emp.id} className={`flex items-center gap-3 px-4 py-3 ${isExcluded ? "opacity-50" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isExcluded ? "bg-gray-100 text-gray-400" : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600"}`}>
                    {emp.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isExcluded ? "text-gray-400 line-through" : "text-gray-900"}`}>{emp.name}</span>
                      {isExcluded && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Excluded</span>}
                    </div>
                    <div className="text-xs text-gray-400">{emp.division?.name} · {emp.employeeStatus}</div>
                  </div>
                  {!isExcluded && (isEditing ? (
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={5} value={editVal}
                        onChange={(e) => setEditVal(parseInt(e.target.value) || 1)}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"/>
                      <button onClick={() => handleSave(emp.id)} disabled={isSaving}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                        {isSaving ? <RefreshCw size={14} className="animate-spin"/> : <Check size={14}/>}
                      </button>
                      <button onClick={() => setEditing(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${hasOverride ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {quota}×/week
                      </span>
                      <button onClick={() => { setEditing(emp.id); setEditVal(quota); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit3 size={14}/>
                      </button>
                      {hasOverride && (
                        <button onClick={() => handleReset(emp.id)} disabled={isSaving}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Reset to default">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => isExcluded ? handleInclude(emp.id) : handleExclude(emp.id)}
                    disabled={isExcluding}
                    title={isExcluded ? "Re-include in WFH" : "Exclude from WFH"}
                    className={`p-1.5 rounded-lg transition-colors ${isExcluded
                      ? "text-green-500 hover:bg-green-50"
                      : "text-gray-300 hover:text-red-500 hover:bg-red-50"}`}>
                    {isExcluding
                      ? <RefreshCw size={14} className="animate-spin"/>
                      : isExcluded ? <UserCheck size={14}/> : <UserX size={14}/>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Weekly Schedule ─────────────────────────────────────────────────────

function ScheduleTab() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [overrideForm, setOverrideForm] = useState(null); // { empId, wfhDate }
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [schRes, empRes] = await Promise.all([
      getWfhSchedule(weekStart).catch(() => ({ data: null })),
      getWfhEligibleEmployees().catch(() => ({ data: [] })),
    ]);
    setData(schRes.data);
    setEmployees(empRes.data || []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteWfhSchedule(id);
      await load();
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setDeleting(null);
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    if (!overrideForm?.empId || !overrideForm?.wfhDate) return;
    setSubmitting(true);
    try {
      await submitWfhSchedule({ employeeId: overrideForm.empId, wfhDate: overrideForm.wfhDate, adminOverride: true });
      setOverrideForm(null);
      await load();
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const { schedules = [], workingDays = [], holidays = {}, divisionCaps = {} } = data || {};

  // Group schedules by date
  const byDate = {};
  for (const s of schedules) {
    const ds = toDateStr(new Date(s.wfhDate));
    if (!byDate[ds]) byDate[ds] = [];
    byDate[ds].push(s);
  }

  // Build per-day cap summary: { divId → cap } for each day
  const getDivCapForDay = (divId) => divisionCaps[divId]?.cap ?? "?";
  const getCapLabel = (divId) => {
    const info = divisionCaps[divId];
    if (!info) return null;
    if (info.memberCount <= 0) return null;
    const parts = [`${info.memberCount} member${info.memberCount !== 1 ? "s" : ""}`];
    if (info.extraDays > 0) {
      parts.push(`cap ${info.baseCap}–${info.cap}/day`);
    } else {
      parts.push(`cap ${info.cap}/day`);
    }
    return parts.join(" · ");
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ChevronLeft size={18}/>
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-800">{getWeekLabel(weekStart)}</div>
        </div>
        <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ChevronRight size={18}/>
        </button>
      </div>

      {/* Override form */}
      {overrideForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Admin Override — Assign WFH Day</h3>
          <form onSubmit={handleOverride} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Employee</label>
              <select value={overrideForm.empId || ""}
                onChange={(e) => setOverrideForm((f) => ({ ...f, empId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                <option value="">-- Select --</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">WFH Date</label>
              <select value={overrideForm.wfhDate || ""}
                onChange={(e) => setOverrideForm((f) => ({ ...f, wfhDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                <option value="">-- Select day --</option>
                {workingDays.map((ds) => (
                  <option key={ds} value={ds}>{getDayShort(ds)}, {formatDateLabel(ds)}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Saving..." : "Assign"}
            </button>
            <button type="button" onClick={() => setOverrideForm(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button onClick={() => setOverrideForm({ empId: "", wfhDate: "" })}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700">
          <Plus size={14}/> Override / Assign
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2"/>
        </div>
      ) : (
        <div className="space-y-3">
          {workingDays.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No working days this week</div>
          ) : workingDays.map((ds) => {
            const daySchedules = byDate[ds] || [];
            const isHol = !!holidays[ds];
            return (
              <div key={ds} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {getDayShort(ds)}, {formatDateLabel(ds)}
                    {isHol && <span className="ml-2 text-xs text-red-500">🎌 {holidays[ds]}</span>}
                  </span>
                  <span className="text-xs text-gray-400">{daySchedules.length} WFH</span>
                </div>
                {daySchedules.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No WFH scheduled</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {daySchedules.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                          {s.employee?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-800">{s.employee?.name}</div>
                          <div className="text-xs text-gray-400">
                            {s.employee?.division?.name}
                            {s.employee?.divisionId && getCapLabel(s.employee.divisionId) && (
                              <span className="ml-1 text-gray-300">({getCapLabel(s.employee.divisionId)})</span>
                            )}
                            {" · "}{s.employee?.plottingCompany?.name}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "ADMIN_OVERRIDE" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>{s.status === "ADMIN_OVERRIDE" ? "Override" : "Scheduled"}</span>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          {deleting === s.id ? <RefreshCw size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Tab: Submission Window Override ─────────────────────────────────────────

function WindowOverrideTab() {
  const [override, setOverride] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWfhWindowOverride();
      setOverride(res.data);
      if (res.data?.isActive) {
        setNote(res.data.note || "");
        if (res.data.expiresAt) {
          // Format for datetime-local input
          const d = new Date(res.data.expiresAt);
          const pad = (n) => String(n).padStart(2, "0");
          setExpiresAt(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    setSaving(true);
    try {
      const res = await setWfhWindowOverride({
        open: true,
        expiresAt: expiresAt || undefined,
        note: note || undefined,
      });
      setOverride(res.data);
    } catch (err) {
      alert(err.message || "Failed to open window");
    } finally { setSaving(false); }
  };

  const handleClose = async () => {
    if (!window.confirm("Close the submission window override? Employees will no longer be able to submit outside Sat-Sun.")) return;
    setSaving(true);
    try {
      const res = await setWfhWindowOverride({ open: false });
      setOverride(res.data);
      setExpiresAt(""); setNote("");
    } catch (err) {
      alert(err.message || "Failed to close window");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400"><RefreshCw size={20} className="animate-spin mx-auto"/></div>;

  const isActive = override?.isActive && (!override.expiresAt || new Date(override.expiresAt) > new Date());

  return (
    <div className="space-y-4 max-w-xl">
      {/* Current state card */}
      <div className={`rounded-xl border p-5 ${isActive ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-3 mb-3">
          {isActive
            ? <Unlock size={20} className="text-green-600"/>
            : <Lock size={20} className="text-gray-400"/>}
          <div>
            <div className={`text-base font-semibold ${isActive ? "text-green-800" : "text-gray-700"}`}>
              {isActive ? "Submission window is OPEN (override active)" : "Submission window follows normal schedule (Sat–Sun)"}
            </div>
            {isActive && (
              <div className="text-sm text-green-600 mt-0.5">
                Opened by {override?.opener?.name || "admin"}
                {override?.expiresAt && ` · Expires ${new Date(override.expiresAt).toLocaleString("id-ID")}`}
                {!override?.expiresAt && " · No expiry set"}
              </div>
            )}
            {isActive && override?.note && (
              <div className="text-sm text-green-700 mt-1 italic">"{override.note}"</div>
            )}
          </div>
        </div>

        {isActive && (
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Lock size={14}/>}
            Close Submission Window
          </button>
        )}
      </div>

      {/* Open override form */}
      {!isActive && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Unlock size={15} className="text-blue-500"/>
            Open Submission Window
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auto-close at (optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to keep open until you manually close it.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Feature just released — allow employees to submit"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleOpen}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw size={14} className="animate-spin"/> : <Unlock size={14}/>}
              Open Submission Window
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2">
        <Clock size={14} className="flex-shrink-0 mt-0.5"/>
        <span>
          Normally employees can only submit their WFH preference on <strong>Saturday and Sunday</strong>.
          Use this override to open the window on any day — useful for initial rollout or special occasions.
          Set an expiry time to auto-close, or close it manually when done.
        </span>
      </div>
    </div>
  );
}

const TABS = [
  { key: "schedule", label: "Weekly Schedule" },
  { key: "window",   label: "Submission Window" },
  { key: "quotas",   label: "Employee Quotas" },
  { key: "scopes",   label: "Feature Scopes" },
];

export default function WfhAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("schedule");

  if (!user || user.accessLevel > 2) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Shield size={40} className="mx-auto mb-3 opacity-30"/>
          <p>Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Monitor size={22} className="text-blue-600"/>
            <h1 className="text-xl font-bold text-gray-900">WFH Scheduling — Admin</h1>
          </div>
          <p className="text-sm text-gray-500">Manage WFH feature scopes, employee quotas, and weekly schedules.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "scopes"   && <ScopesTab />}
        {tab === "quotas"   && <QuotasTab />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "window"   && <WindowOverrideTab />}
      </div>
    </div>
  );
}
