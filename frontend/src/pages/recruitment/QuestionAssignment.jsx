import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Plus, Save, X } from "lucide-react";
import apiClient from "../../api/client";

const TYPE_LABELS = {
  bool: "Yes / No",
  single: "Single choice",
  multi: "Multi choice",
  number: "Number",
  text: "Text",
};

function normalizeAssigned(rows) {
  return rows.map((row) => row.question ? { ...row.question, order: row.order } : row);
}

export default function QuestionAssignment() {
  const { postingId } = useParams();
  const [job, setJob] = useState(null);
  const [bank, setBank] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [bankRes, assignedRes] = await Promise.all([
          apiClient.get("/recruitment/questions"),
          apiClient.get(`/recruitment/questions/position/${postingId}`),
        ]);
        setBank(bankRes.data);
        setAssigned(normalizeAssigned(assignedRes.data));
        setDirty(false);
        apiClient
          .get(`/recruitment/jobs/${postingId}`)
          .then((res) => setJob(res.data))
          .catch(() => setJob(null));
      } catch (e) {
        alert(e.message || "Failed to load question assignment");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [postingId]);

  const available = useMemo(() => {
    const assignedIds = new Set(assigned.map((q) => q.id));
    return bank.filter((q) => !assignedIds.has(q.id));
  }, [bank, assigned]);

  function add(q) {
    setAssigned([...assigned, q]);
    setDirty(true);
  }

  function remove(q) {
    setAssigned(assigned.filter((a) => a.id !== q.id));
    setDirty(true);
  }

  function move(from, to) {
    if (from === null || from === to) return;
    const next = [...assigned];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setAssigned(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = assigned.map((q, i) => ({ questionId: q.id, order: i + 1 }));
      const res = await apiClient.put(`/recruitment/questions/position/${postingId}`, payload);
      setAssigned(normalizeAssigned(res.data));
      setDirty(false);
    } catch (e) {
      alert(e.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to="/recruitment/jobs" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4" />
        Job Postings
      </Link>

      <div className="flex items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Assignment</h1>
          <p className="text-sm text-gray-500 mt-1">
            {job?.title || "Position"} · {assigned.length} assigned question{assigned.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Available</h2>
            <p className="text-xs text-gray-500">{available.length} question{available.length !== 1 ? "s" : ""} in bank</p>
          </div>
          <div className="divide-y divide-gray-100">
            {available.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">All questions are assigned.</p>
            ) : available.map((q) => (
              <QuestionRow key={q.id} question={q}>
                <button onClick={() => add(q)} className="text-blue-600 hover:text-blue-800">
                  <Plus className="w-4 h-4" />
                </button>
              </QuestionRow>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Assigned</h2>
            <p className="text-xs text-gray-500">Drag to reorder, then Save.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {assigned.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No questions assigned to this position.</p>
            ) : assigned.map((q, index) => (
              <div
                key={q.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  move(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-move"
              >
                <GripVertical className="w-4 h-4 mt-0.5 text-gray-300 shrink-0" />
                <span className="text-xs font-semibold text-gray-400 w-5 mt-0.5">{index + 1}</span>
                <QuestionSummary question={q} />
                <button onClick={() => remove(q)} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuestionRow({ question, children }) {
  return (
    <div className="flex items-start gap-3 p-4 hover:bg-gray-50">
      <QuestionSummary question={question} />
      {children}
    </div>
  );
}

function QuestionSummary({ question }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-900">{question.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
          {TYPE_LABELS[question.type] || question.type}
        </span>
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
          {question.scope}
        </span>
        {question.isKnockout && (
          <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
            {question.knockoutRule?.soft ? "Soft knockout" : "Hard knockout"}
          </span>
        )}
      </div>
    </div>
  );
}
