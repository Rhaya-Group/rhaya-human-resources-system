import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Zap, ChevronDown } from "lucide-react";
import apiClient from "../../api/client";

const TYPES = ["bool", "single", "multi", "number", "text"];
const SCOPES = ["position", "common"];

const TYPE_LABELS = {
  bool: "Yes / No",
  single: "Single choice",
  multi: "Multi choice",
  number: "Number",
  text: "Text",
};

const SCOPE_LABELS = {
  position: "Per application",
  common: "Common (asked once)",
};

const OPERATORS = ["equals", "min", "max", "includes"];

const emptyForm = {
  text: "",
  type: "bool",
  scope: "position",
  isKnockout: false,
  knockoutRule: null,
};

const emptyRule = { operator: "equals", value: "", soft: false };

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterScope, setFilterScope] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [rule, setRule] = useState(emptyRule);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    try {
      setLoading(true);
      const params = {};
      if (filterScope) params.scope = filterScope;
      if (filterType) params.type = filterType;
      const res = await apiClient.get("/recruitment/questions", { params });
      setQuestions(res.data);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (!loading) fetch(); }, [filterScope, filterType]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setRule(emptyRule);
    setShowModal(true);
  }

  function openEdit(q) {
    setEditing(q);
    setForm({
      text: q.text,
      type: q.type,
      scope: q.scope,
      isKnockout: q.isKnockout,
      knockoutRule: q.knockoutRule,
    });
    setRule(q.knockoutRule ? { ...emptyRule, ...q.knockoutRule } : emptyRule);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setRule(emptyRule);
  }

  async function save() {
    if (!form.text.trim()) return alert("Question text required");
    setSaving(true);
    try {
      const payload = {
        ...form,
        knockoutRule: form.isKnockout ? { ...rule, value: rule.value } : null,
      };
      if (editing) {
        await apiClient.put(`/recruitment/questions/${editing.id}`, payload);
      } else {
        await apiClient.post("/recruitment/questions", payload);
      }
      closeModal();
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(q) {
    if (!confirm(`Delete question?\n\n"${q.text}"\n\nThis will fail if the question is assigned to a position.`)) return;
    try {
      await apiClient.delete(`/recruitment/questions/${q.id}`);
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || "Delete failed");
    }
  }

  const filtered = questions.filter(q =>
    (!filterScope || q.scope === filterScope) &&
    (!filterType || q.type === filterType)
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-sm text-gray-500 mt-1">
            Screening questions shared across job postings. Assign them per position in Question Assignment.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New question
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={filterScope}
          onChange={e => setFilterScope(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
        >
          <option value="">All scopes</option>
          {SCOPES.map(s => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700"
        >
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} question{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No questions yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Question</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Knockout</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{q.text}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-medium">
                      {TYPE_LABELS[q.type] || q.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      q.scope === "common"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {SCOPE_LABELS[q.scope] || q.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {q.isKnockout ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Zap className="w-3 h-3" />
                        {q.knockoutRule?.soft ? "Soft" : "Hard"}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(q)} className="text-gray-400 hover:text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(q)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                {editing ? "Edit question" : "New question"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question text</label>
                <textarea
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Do you have experience with Figma?"
                />
              </div>

              {/* Type + Scope */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    value={form.scope}
                    onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {SCOPES.map(s => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {form.scope === "common" ? "Stored once per candidate, prefilled on repeat applications." : "Stored per application."}
                  </p>
                </div>
              </div>

              {/* Knockout toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isKnockout}
                    onChange={e => setForm(f => ({ ...f, isKnockout: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Knockout question
                  </span>
                </label>
              </div>

              {/* Knockout rule */}
              {form.isKnockout && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-amber-800">Knockout rule</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-amber-700 mb-1">Operator</label>
                      <select
                        value={rule.operator}
                        onChange={e => setRule(r => ({ ...r, operator: e.target.value }))}
                        className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs bg-white"
                      >
                        {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-amber-700 mb-1">Value (triggers knockout)</label>
                      <input
                        value={rule.value}
                        onChange={e => setRule(r => ({ ...r, value: e.target.value }))}
                        placeholder={form.type === "bool" ? "true or false" : "e.g. 2"}
                        className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.soft}
                      onChange={e => setRule(r => ({ ...r, soft: e.target.checked }))}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs text-amber-800">
                      Soft knockout — flag for HR review instead of auto-reject
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
