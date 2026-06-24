// frontend/src/pages/WfhScheduler.jsx
// Employee-facing WFH day picker — week-grid layout (mirrors WeekView in WorkStatusDashboard).
// Active submission window: Saturday + Sunday (WIB) to pick next week's WFH day.

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getWfhSchedule,
  submitWfhSchedule,
  deleteWfhSchedule,
} from "../api/client";
import {
  Monitor, Clock, Lock, CheckCircle2,
  AlertCircle, RefreshCw, X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_SHORT_ALL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDayShort(ds) {
  return DAY_SHORT_ALL[new Date(ds + "T00:00:00").getDay()];
}
function formatDateLabel(ds) {
  const d = new Date(ds + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
function getWeekLabel(weekStartDate) {
  if (!weekStartDate) return "";
  const mon = new Date(weekStartDate + "T00:00:00");
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  return `${formatDateLabel(weekStartDate)} – ${formatDateLabel(fri.toISOString().split("T")[0])} ${fri.getFullYear()}`;
}
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const today = formatDate(new Date());

// ─── Component ────────────────────────────────────────────────────────────────

export default function WfhScheduler() {
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [submitting, setSubmitting] = useState(null); // dateStr
  const [deleting, setDeleting]     = useState(null); // id
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getWfhSchedule();
      setData(res.data);
    } catch (err) {
      setError(err.status === 403 ? "wfh_not_available" : (err.message || "Failed to load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = async (ds) => {
    if (submitting) return;
    setSubmitting(ds);
    try {
      await submitWfhSchedule({ wfhDate: ds });
      showToast(`WFH booked for ${getDayShort(ds)}, ${formatDateLabel(ds)}`);
      await load();
    } catch (err) {
      showToast(err.message || "Failed to book", "error");
    } finally { setSubmitting(null); }
  };

  const handleDelete = async (id, ds) => {
    if (!window.confirm(`Remove WFH booking for ${getDayShort(ds)}, ${formatDateLabel(ds)}?`)) return;
    setDeleting(id);
    try {
      await deleteWfhSchedule(id);
      showToast("WFH booking removed");
      await load();
    } catch (err) {
      showToast(err.message || "Failed to remove", "error");
    } finally { setDeleting(null); }
  };

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-gray-400" />
    </div>
  );

  if (error === "wfh_not_available") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center text-gray-500 max-w-sm">
        <Monitor size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">WFH Scheduling not available</p>
        <p className="text-sm mt-1">This feature is not enabled for your entity.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center text-red-500">
        <AlertCircle size={40} className="mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={load} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
      </div>
    </div>
  );

  // ── Destructure data ───────────────────────────────────────────────────────

  const {
    mySchedules = [],
    divisionSchedules = [],
    divisionMembers: allDivisionMembers = [],
    weekStartDate,
    workingDays = [],
    holidays = {},
    quotaPerWeek = 1,
    usedQuota = 0,
    divisionCap = 1,
    divisionDayCounts = {},
    isSubmissionWindow,
    isLocked,
  } = data || {};

  const myDateSet = new Set(mySchedules.map((s) => s.wfhDate?.split("T")[0] || s.wfhDate));
  const remaining  = quotaPerWeek - usedQuota;

  // Build schedule lookup: employeeId → { dateStr → schedule }
  const scheduleByMember = new Map();
  for (const s of divisionSchedules) {
    const eid = s.employeeId || s.employee?.id;
    if (!eid || eid === user?.id) continue;
    if (!scheduleByMember.has(eid)) scheduleByMember.set(eid, {});
    const ds = s.wfhDate?.split("T")[0] || s.wfhDate;
    scheduleByMember.get(eid)[ds] = s;
  }

  // All division members from API (includes those with no schedule yet)
  const divisionMembers = allDivisionMembers.map((emp) => ({
    employee: emp,
    schedulesByDate: scheduleByMember.get(emp.id) || {},
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === "error"
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {toast.type === "error" ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Monitor size={20} className="text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">WFH Schedule</h1>
            </div>
            <p className="text-sm text-gray-500 ml-7">{getWeekLabel(weekStartDate)}</p>
          </div>

          {/* Status pill */}
          <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
            isSubmissionWindow && !isLocked
              ? "bg-green-100 text-green-700"
              : isLocked
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-500"
          }`}>
            {isLocked
              ? <><Lock size={13}/> Locked — contact HR to change</>
              : isSubmissionWindow
              ? <><Clock size={13}/> Submission open</>
              : <><Clock size={13}/> Opens Saturday &amp; Sunday</>
            }
          </div>
        </div>

        {/* Quota bar */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">Weekly quota</span>
          <div className="flex gap-1.5">
            {Array.from({ length: quotaPerWeek }).map((_, i) => (
              <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center ${
                i < usedQuota ? "bg-blue-500" : "bg-gray-100 border border-gray-200"
              }`}>
                {i < usedQuota && <CheckCircle2 size={12} className="text-white"/>}
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-500">{usedQuota}/{quotaPerWeek} used</span>
          {remaining > 0 && isSubmissionWindow && !isLocked && (
            <span className="ml-auto text-xs text-blue-600 font-medium">{remaining} remaining</span>
          )}
        </div>

        {/* Week grid table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              {/* Day headers */}
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-48 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    Member
                  </th>
                  {workingDays.map((ds) => {
                    const isToday   = ds === today;
                    const isHoliday = !!holidays?.[ds];
                    return (
                      <th key={ds} className={`text-center px-2 py-2 font-medium min-w-[100px] ${
                        isToday ? "bg-blue-50 text-blue-700" : isHoliday ? "bg-red-50/60 text-red-400" : "text-gray-600"
                      }`}>
                        <div className="text-xs font-semibold">{getDayShort(ds)}</div>
                        <div className={`text-base font-bold ${isToday ? "text-blue-600" : isHoliday ? "text-red-400" : ""}`}>
                          {new Date(ds + "T00:00:00").getDate()}
                        </div>
                        {isToday && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-0.5"/>}
                        {isHoliday && (
                          <div className="text-xs text-red-400 font-normal truncate max-w-[90px] mx-auto" title={holidays[ds]}>
                            🎌 {holidays[ds]}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {/* ── My row ── */}
                <tr className="border-b border-gray-100 bg-blue-50/30">
                  <td className="px-4 py-2.5 sticky left-0 border-r border-gray-100 z-10 bg-blue-50/30">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {user?.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate max-w-[110px]">
                          {user?.name} <span className="text-blue-500">★</span>
                        </div>
                        <div className="text-xs text-gray-400">You</div>
                      </div>
                    </div>
                  </td>

                  {workingDays.map((ds) => {
                    const isMyDay    = myDateSet.has(ds);
                    const myRec      = mySchedules.find((s) => (s.wfhDate?.split("T")[0] || s.wfhDate) === ds);
                    const dayCount   = divisionDayCounts[ds] ?? 0;
                    const isFull     = !isMyDay && dayCount >= divisionCap;
                    const isHol      = !!holidays?.[ds];
                    const canSelect  = isSubmissionWindow && !isLocked && !isMyDay && !isFull && !isHol && remaining > 0;
                    const canRemove  = isMyDay && myRec && isSubmissionWindow && !isLocked;
                    const isSub      = submitting === ds;
                    const isDel      = deleting === myRec?.id;

                    return (
                      <td key={ds} className={`text-center px-1.5 py-2 ${isHol ? "bg-red-50/40" : ""}`}>
                        {isHol ? (
                          <span className="text-xs text-red-300">Off</span>
                        ) : isMyDay ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg">
                              <Monitor size={11}/> WFH
                            </span>
                            {canRemove && (
                              <button
                                onClick={() => handleDelete(myRec.id, ds)}
                                disabled={!!deleting}
                                className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                                title="Remove"
                              >
                                {isDel ? <RefreshCw size={10} className="animate-spin"/> : <X size={10}/>}
                              </button>
                            )}
                          </div>
                        ) : canSelect ? (
                          <button
                            onClick={() => handleSelect(ds)}
                            disabled={!!submitting}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-dashed border-blue-300 text-blue-500 text-xs font-medium rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors disabled:opacity-40"
                          >
                            {isSub ? <RefreshCw size={10} className="animate-spin"/> : <>+ Pick</>}
                          </button>
                        ) : isFull ? (
                          <span className="text-xs text-orange-400 font-medium">Full</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* ── Division member rows ── */}
                {divisionMembers.length > 0 && divisionMembers.map(({ employee, schedulesByDate }) => {
                  const hasAnySchedule = Object.keys(schedulesByDate).length > 0;
                  return (
                  <tr key={employee?.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2 sticky left-0 border-r border-gray-100 z-10 bg-inherit">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                          hasAnySchedule ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-600"
                        }`}>
                          {employee?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate max-w-[110px]">
                            {employee?.name}
                          </div>
                          {!hasAnySchedule && (
                            <div className="text-xs text-amber-500">Not filled</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {workingDays.map((ds) => {
                      const sched = schedulesByDate[ds];
                      const isHol = !!holidays?.[ds];
                      return (
                        <td key={ds} className={`text-center px-1.5 py-2 ${isHol ? "bg-red-50/40" : ""}`}>
                          {sched ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg ${
                              sched.status === "ADMIN_OVERRIDE"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              <Monitor size={10}/>
                              {sched.status === "ADMIN_OVERRIDE" ? "Admin" : "WFH"}
                            </span>
                          ) : isHol ? (
                            <span className="text-xs text-red-300">—</span>
                          ) : (
                            <span className="text-xs text-gray-200">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>

              {/* Footer: slot counts per day */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50 border-r border-gray-200 uppercase tracking-wide">
                    Slots
                  </td>
                  {workingDays.map((ds) => {
                    const count  = divisionDayCounts[ds] ?? 0;
                    const isHol  = !!holidays?.[ds];
                    const isFull = count >= divisionCap;
                    return (
                      <td key={ds} className={`text-center px-1 py-2 ${isHol ? "bg-red-50/40" : ""}`}>
                        {isHol ? (
                          <span className="text-xs text-red-300">—</span>
                        ) : (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            isFull
                              ? "bg-orange-100 text-orange-600"
                              : count > 0
                              ? "bg-blue-100 text-blue-700"
                              : "text-gray-300"
                          }`}>
                            {count}/{divisionCap}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Info notes */}
        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2">
            <Lock size={14} className="flex-shrink-0 mt-0.5"/>
            <span>WFH day for this week is locked. To change or swap, please email HR.</span>
          </div>
        )}
        {!isSubmissionWindow && !isLocked && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2">
            <Clock size={14} className="flex-shrink-0 mt-0.5"/>
            <span>Submission window opens on <strong>Saturday and Sunday</strong>. Come back then to pick your WFH day for next week.</span>
          </div>
        )}
      </div>
    </div>
  );
}
