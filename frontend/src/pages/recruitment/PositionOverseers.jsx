import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import apiClient from "../../api/client";
import UserPicker from "./UserPicker";

const EMPTY = { hrisUserId: "", access: "view" };

export default function PositionOverseers() {
  const { postingId } = useParams();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["hrJob", postingId],
    queryFn: async () => (await apiClient.get(`/recruitment/jobs/${postingId}`)).data,
  });

  const { data: overseers = [], isLoading } = useQuery({
    queryKey: ["positionOverseers", postingId],
    queryFn: async () => (await apiClient.get(`/recruitment/postings/${postingId}/overseers`)).data,
  });

  const { data: usersRes } = useQuery({
    queryKey: ["hrisUsers"],
    queryFn: async () => (await apiClient.get("/users")).data,
  });
  const users = usersRes?.users || usersRes?.data || [];
  const overseerIds = new Set(overseers.map((row) => row.hrisUserId));

  async function submit(e) {
    e.preventDefault();
    if (!form.hrisUserId) return;
    setBusy(true);
    try {
      await apiClient.post(`/recruitment/postings/${postingId}/overseers`, form);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["positionOverseers", postingId] });
    } catch (err) {
      alert(err?.error || err?.response?.data?.error || "Failed to add overseer");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!confirm(`Remove ${row.hrisUser?.name || row.hrisUser?.email || "this user"}?`)) return;
    try {
      await apiClient.delete(`/recruitment/postings/${postingId}/overseers/${row.hrisUserId}`);
      qc.invalidateQueries({ queryKey: ["positionOverseers", postingId] });
    } catch (err) {
      alert(err?.error || err?.response?.data?.error || "Failed to remove overseer");
    }
  }

  async function updateAccess(row, access) {
    try {
      await apiClient.post(`/recruitment/postings/${postingId}/overseers`, {
        hrisUserId: row.hrisUserId,
        access,
      });
      qc.invalidateQueries({ queryKey: ["positionOverseers", postingId] });
    } catch (err) {
      alert(err?.error || err?.response?.data?.error || "Failed to update access");
      qc.invalidateQueries({ queryKey: ["positionOverseers", postingId] });
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/recruitment/jobs" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Postings
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Position Overseers</h1>
        <p className="text-sm text-gray-500 mt-1">{job?.title || "Manage posting visibility"}</p>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-4 mb-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Add overseer</h2>
        <div className="grid md:grid-cols-[1fr_150px_auto] gap-3">
          <UserPicker
            users={users}
            value={form.hrisUserId}
            onChange={(hrisUserId) => setForm((next) => ({ ...next, hrisUserId }))}
            excludeIds={[...overseerIds]}
          />
          <select
            value={form.access}
            onChange={(e) => setForm((next) => ({ ...next, access: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white h-10"
          >
            <option value="view">View</option>
            <option value="manage">Manage</option>
          </select>
          <button
            type="submit"
            disabled={busy || !form.hrisUserId}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium h-10 hover:bg-blue-700 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" /> {busy ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Current overseers</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : overseers.length === 0 ? (
          <p className="text-sm text-gray-400">No overseers added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {overseers.map((row) => (
              <li key={row.hrisUserId} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{row.hrisUser?.name || row.hrisUser?.email}</p>
                  <p className="text-sm text-gray-500">
                    {row.hrisUser?.email} · access level {row.hrisUser?.accessLevel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={row.access}
                    onChange={(e) => updateAccess(row, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  >
                    <option value="view">View</option>
                    <option value="manage">Manage</option>
                  </select>
                  <button type="button" onClick={() => remove(row)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
