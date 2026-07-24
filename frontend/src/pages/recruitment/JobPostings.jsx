import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ListChecks, Users, Pencil, Trash2, UserPlus } from "lucide-react";
import apiClient from "../../api/client";
import { useAuth } from "../../hooks/useAuth";

const EMPTY = {
  title: "", description: "", department: "", location: "",
  employmentType: "FULL_TIME", status: "DRAFT", openings: 1, closeDate: "", plottingCompanyId: "",
};
const EMP_TYPES = ["FULL_TIME", "CONTRACT", "INTERN"];
const STATUSES = ["DRAFT", "OPEN", "CLOSED"];

export default function JobPostings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isHr = user?.accessLevel <= 2;
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["hrJobs"],
    queryFn: async () => (await apiClient.get("/recruitment/jobs")).data,
  });
  const { data: entities = [] } = useQuery({
    queryKey: ["entities"],
    enabled: isHr,
    queryFn: async () => (await apiClient.get("/plotting-companies")).data?.data || [],
  });

  function reset() { setForm(EMPTY); setEditingId(null); setError(null); }

  function startEdit(job) {
    setEditingId(job.id);
    setError(null);
    setForm({
      title: job.title, description: job.description,
      department: job.department || "", location: job.location || "",
      employmentType: job.employmentType, status: job.status,
      openings: job.openings, plottingCompanyId: job.plottingCompanyId,
      closeDate: job.closeDate ? job.closeDate.slice(0, 10) : "",
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, openings: Number(form.openings) || 1, closeDate: form.closeDate || null };
    try {
      if (editingId) await apiClient.put(`/recruitment/jobs/${editingId}`, payload);
      else await apiClient.post("/recruitment/jobs", payload);
      reset();
      qc.invalidateQueries({ queryKey: ["hrJobs"] });
    } catch (err) {
      setError(err?.response?.data?.error || "Save failed.");
    }
  }

  async function remove(id) {
    if (!confirm("Delete this posting and all its applications?")) return;
    await apiClient.delete(`/recruitment/jobs/${id}`);
    qc.invalidateQueries({ queryKey: ["hrJobs"] });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage open positions and their recruitment pipeline.</p>
      </div>

      <div className={isHr ? "grid md:grid-cols-2 gap-6" : "space-y-3"}>
        {isHr && (
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 h-fit">
          <h2 className="font-semibold text-gray-900">{editingId ? "Edit posting" : "New posting"}</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input required placeholder="Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea required placeholder="Description" rows={4} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select required value={form.plottingCompanyId}
            onChange={(e) => setForm({ ...form, plottingCompanyId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Select entity…</option>
            {entities.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Department" value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Location" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {EMP_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
            <select value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" min={1} placeholder="Openings" value={form.openings}
              onChange={(e) => setForm({ ...form, openings: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.closeDate}
              onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              {editingId ? "Save changes" : "Create posting"}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
            )}
          </div>
        </form>
        )}

        <div className="space-y-3">
          {jobs.length === 0 && <p className="text-gray-500 text-sm">No postings yet.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{job.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {job.plottingCompany?.name} · {job.status} · {job.employmentType?.replace("_", " ")}
                  </p>
                </div>
                {isHr && <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(job)} className="text-gray-400 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(job.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>}
              </div>
              <Link to={`/recruitment/jobs/${job.id}/pipeline`}
                className="mt-3 mr-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <Users className="w-4 h-4" /> {job._count?.applications ?? 0} applicant(s) · pipeline
              </Link>
              {isHr && <Link to={`/recruitment/jobs/${job.id}/questions`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <ListChecks className="w-4 h-4" /> Manage Questions
              </Link>}
              {isHr && <Link to={`/recruitment/jobs/${job.id}/overseers`}
                className="mt-3 ml-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                <UserPlus className="w-4 h-4" /> Overseers
              </Link>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
