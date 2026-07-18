import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../api/client";
import RecruitmentDocumentList from "./RecruitmentDocumentList.jsx";

const emptyForm = {
  title: "",
  stage: "",
  kind: "link",
  linkUrl: "",
  file: null,
};

export default function DocumentManagement() {
  const qc = useQueryClient();
  const [scope, setScope] = useState("applicationId");
  const [jobId, setJobId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const params = targetId.trim() ? { [scope]: targetId.trim() } : null;

  const { data: jobs = [] } = useQuery({
    queryKey: ["hrJobs"],
    queryFn: async () => (await apiClient.get("/recruitment/jobs")).data,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["documentApplications", jobId],
    enabled: scope === "applicationId" && Boolean(jobId),
    queryFn: async () => (await apiClient.get("/recruitment/applications", { params: { postingId: jobId } })).data,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["recruitmentDocuments", scope, targetId],
    enabled: Boolean(params),
    queryFn: async () => (await apiClient.get("/recruitment/documents", { params })).data,
  });

  function changeScope(nextScope) {
    setScope(nextScope);
    setJobId("");
    setTargetId("");
  }

  async function issue(e) {
    e.preventDefault();
    if (!params || !form.title.trim()) return;
    setBusy(true);
    try {
      if (form.kind === "file") {
        const body = new FormData();
        body.append(scope, targetId.trim());
        body.append("kind", "file");
        body.append("title", form.title.trim());
        if (form.stage.trim()) body.append("stage", form.stage.trim());
        body.append("file", form.file);
        await apiClient.post("/recruitment/documents", body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await apiClient.post("/recruitment/documents", {
          ...params,
          kind: "link",
          title: form.title.trim(),
          stage: form.stage.trim() || undefined,
          linkUrl: form.linkUrl.trim(),
        });
      }
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["recruitmentDocuments", scope, targetId] });
    } catch (error) {
      alert(error.response?.data?.error || "Failed to issue document");
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc) {
    if (!confirm(`Delete document "${doc.title}"?`)) return;
    try {
      await apiClient.delete(`/recruitment/documents/${doc.id}`);
      qc.invalidateQueries({ queryKey: ["recruitmentDocuments", scope, targetId] });
    } catch (error) {
      alert(error.response?.data?.error || "Failed to delete document");
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
        <p className="text-sm text-gray-500 mt-1">Issue offer letters, contracts, or links to a candidate application or posting.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Target</h2>
        <div className="grid md:grid-cols-[180px_1fr] gap-3">
          <select value={scope} onChange={(e) => changeScope(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            <option value="applicationId">Application ID</option>
            <option value="jobPostingId">Job Posting ID</option>
          </select>
          {scope === "jobPostingId" ? (
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">Select job posting...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.title} ({job._count?.applications ?? 0} applicants)</option>
              ))}
            </select>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <select value={jobId} onChange={(e) => { setJobId(e.target.value); setTargetId(""); }} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                <option value="">Select job posting...</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title} ({job._count?.applications ?? 0} applicants)</option>
                ))}
              </select>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={!jobId} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white disabled:bg-gray-50">
                <option value="">{jobId ? "Select candidate application..." : "Select a posting first"}</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>{app.applicant?.name || "Unnamed"} - {app.stage}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={issue} className="bg-white border border-gray-200 rounded-lg p-4 mb-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Issue outbound document</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            value={form.stage}
            onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
            placeholder="Stage (optional)"
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value, file: null, linkUrl: "" }))} className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
            <option value="link">Link</option>
            <option value="file">File</option>
          </select>
          {form.kind === "link" ? (
            <input
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
              placeholder="https://..."
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="file"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              className="text-sm"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !params || !form.title.trim() || (form.kind === "link" ? !form.linkUrl.trim() : !form.file)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Issuing..." : "Issue document"}
        </button>
      </form>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Documents</h2>
        {!params ? (
          <p className="text-sm text-gray-400">Enter an application or job posting ID to load documents.</p>
        ) : isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <RecruitmentDocumentList documents={documents} onDelete={remove} />
        )}
      </section>
    </div>
  );
}
