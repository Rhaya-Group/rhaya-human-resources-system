import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../api/client";
import { STAGES, STAGE_LABELS, StageBadge } from "../../utils/stages.jsx";

export default function Pipeline() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data: job } = useQuery({
    queryKey: ["hrJob", id],
    queryFn: async () => (await apiClient.get(`/recruitment/jobs/${id}`)).data,
  });

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["pipeline", id],
    queryFn: async () =>
      (await apiClient.get("/recruitment/applications", { params: { postingId: id } })).data,
  });

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = apps.filter((a) => a.stage === s);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <Link to="/recruitment/jobs" className="text-sm text-blue-600 hover:underline">← Postings</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{job?.title || "Pipeline"}</h1>
      <p className="text-sm text-gray-500 mb-5">
        {job?.plottingCompany?.name} · {apps.length} applicant(s)
      </p>

      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => (
            <div key={stage} className="bg-gray-100 rounded-lg p-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold text-gray-600">{STAGE_LABELS[stage]}</span>
                <span className="text-xs text-gray-400">{byStage[stage].length}</span>
              </div>
              <div className="space-y-2">
                {byStage[stage].map((a) => (
                  <button key={a.id} onClick={() => setSelected(a)}
                    className="w-full text-left bg-white border border-gray-200 rounded p-2 hover:border-blue-400">
                    <p className="text-sm font-medium truncate">{a.applicant?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{a.applicant?.email}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ApplicantDrawer
          applicationId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["pipeline", id] });
            qc.invalidateQueries({ queryKey: ["hrJobs"] });
          }}
        />
      )}
    </div>
  );
}

function ApplicantDrawer({ applicationId, onClose, onChanged }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [stage, setStage] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: app } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: async () => (await apiClient.get(`/recruitment/applications/${applicationId}`)).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["application", applicationId] });
    onChanged();
  }

  async function advance() {
    if (!stage) return;
    setBusy(true);
    try {
      await apiClient.patch(`/recruitment/applications/${applicationId}/stage`, {
        stage, note: note || undefined, rejectedReason: rejectedReason || undefined,
      });
      setNote(""); setStage(""); setRejectedReason("");
      refresh();
    } finally { setBusy(false); }
  }

  async function addNote() {
    if (!note) return;
    setBusy(true);
    try {
      await apiClient.post(`/recruitment/applications/${applicationId}/notes`, { note });
      setNote("");
      refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">{app?.applicant?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {app && (
          <>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p>{app.applicant?.email}{app.applicant?.phone ? ` · ${app.applicant.phone}` : ""}</p>
              <p>Current: <StageBadge stage={app.stage} /></p>
              {app.resumeUrl && (
                <a href={app.resumeUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  View resume
                </a>
              )}
              {app.coverLetter && (
                <p className="whitespace-pre-wrap text-gray-700 mt-2 border-l-2 border-gray-200 pl-2">{app.coverLetter}</p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <label className="text-xs font-semibold text-gray-600">Move to stage</label>
              <select value={stage} onChange={(e) => setStage(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                <option value="">Select stage…</option>
                {STAGES.filter((s) => s !== app.stage).map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
              {stage === "rejected" && (
                <input placeholder="Rejection reason (optional)" value={rejectedReason}
                  onChange={(e) => setRejectedReason(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              )}
              <textarea placeholder="Note (optional, attached to the change)" rows={2} value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button disabled={busy || !stage} onClick={advance}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  Move stage
                </button>
                <button disabled={busy || !note} onClick={addNote}
                  className="px-3 py-2 rounded text-sm border border-gray-300 disabled:opacity-50">
                  Add note only
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 mt-4 pt-4">
              <h3 className="text-xs font-semibold text-gray-600 mb-2">Timeline</h3>
              <ul className="space-y-2">
                {app.events?.map((ev) => (
                  <li key={ev.id} className="text-sm">
                    <span className="text-gray-400 text-xs">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                    <p className="text-gray-700">
                      {ev.type === "STAGE_CHANGE"
                        ? `${ev.fromStage ? STAGE_LABELS[ev.fromStage] + " → " : ""}${STAGE_LABELS[ev.toStage] || ev.toStage}`
                        : ev.type}
                      {ev.note ? ` — ${ev.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
