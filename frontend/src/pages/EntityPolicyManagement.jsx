// frontend/src/pages/EntityPolicyManagement.jsx
import { useState, useEffect } from "react";
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import apiClient from "../api/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const APPROVER_OPTIONS = [
  { value: "supervisor", label: "Supervisor" },
  { value: "dept_head", label: "Department Head" },
  { value: "hr", label: "HR" },
];

const DEFAULT_FORM = {
  scopeType: "group", // 'group' | 'entity'
  entityGroupId: "",
  entityId: "",
  label: "",
  overtimeMode: "post",
  overtimeSubmissionWindowDays: 7,
  overtimeAllowLateSubmission: false,
  leaveApprovalSteps: 1,
  leaveStep1Approvers: ["supervisor", "dept_head", "hr"],
  leaveStep2Approvers: ["hr"],
  overtimeRateWeekday: 1.5,
  overtimeRateWeekend: 2.0,
  overtimeRateHoliday: 3.0,
  lateToleranceMinutes: 15,
  internalPolicyUrl: "",
  notes: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EntityPolicyManagement() {
  const [policies, setPolicies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // policy being edited

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [polRes, grpRes, entRes] = await Promise.all([
        apiClient.get("/entity-policies"),
        apiClient.get("/entity-groups"),
        apiClient.get("/plotting-companies"),
      ]);
      setPolicies(polRes.data.data || []);
      setGroups(grpRes.data.data || []);
      setEntities(entRes.data.data || []);
    } catch (err) {
      console.error("fetchAll error:", err);
      alert("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(policy) {
    setEditing(policy);
    setShowModal(true);
  }

  async function handleDelete(policy) {
    const name = policy.label || policy.id;
    if (
      !confirm(
        `Delete policy "${name}"?\n\nEntities using this policy will fall back to their group policy or the default.`,
      )
    )
      return;
    try {
      await apiClient.delete(`/entity-policies/${policy.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete policy");
    }
  }

  // ── Enrich policies with group / entity name for display ──────────────────
  const enriched = policies.map((p) => ({
    ...p,
    _groupName: p.entityGroup?.name || null,
    _entityName: p.plottingCompany?.name || null,
    _scopeLabel: p.entityGroup
      ? `Group: ${p.entityGroup.name}`
      : p.plottingCompany
        ? `Entity: ${p.plottingCompany.name}`
        : "—",
  }));

  // Entities that already have a policy (entity-specific)
  const coveredEntityIds = new Set(
    policies.filter((p) => p.entityId).map((p) => p.entityId),
  );
  // Groups that already have a policy
  const coveredGroupIds = new Set(
    policies.filter((p) => p.entityGroupId).map((p) => p.entityGroupId),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Entity Policies
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure business rules per entity group or specific entity.
            Entity-specific policies override group policies; both override the
            default.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Policy
        </button>
      </div>

      {/* Default policy info banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Default policy</strong> (applies when no policy is
          configured): overtime = post-submission, 7-day window &nbsp;·&nbsp;
          leave = single-step approval &nbsp;·&nbsp; rates = 1.5× / 2.0× / 3.0×
        </div>
      </div>

      {/* Policy list */}
      {enriched.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Shield className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No policies configured yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            All entities will use the default policy.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Policy
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {enriched.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onEdit={() => openEdit(policy)}
              onDelete={() => handleDelete(policy)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <PolicyModal
          editing={editing}
          groups={groups}
          entities={entities}
          coveredGroupIds={coveredGroupIds}
          coveredEntityIds={coveredEntityIds}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

// ─── Policy Card ──────────────────────────────────────────────────────────────

function PolicyCard({ policy, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const step1 = Array.isArray(policy.leaveStep1Approvers)
    ? policy.leaveStep1Approvers.join(", ")
    : policy.leaveStep1Approvers;
  const step2 = Array.isArray(policy.leaveStep2Approvers)
    ? policy.leaveStep2Approvers.join(", ")
    : policy.leaveStep2Approvers;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Card header */}
      <div className="p-4 flex items-start gap-4">
        {/* Color dot — from group color if available */}
        <div
          className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: policy.entityGroup?.color || "#6B7280" }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">
              {policy.label || "Unnamed Policy"}
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {policy._scopeLabel}
            </span>
          </div>

          {/* Quick summary row */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span
              className={`px-2 py-0.5 rounded font-medium ${
                policy.overtimeMode === "pre"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              OT:{" "}
              {policy.overtimeMode === "pre"
                ? "Pre-approval"
                : `Post (H+${policy.overtimeSubmissionWindowDays})`}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-medium ${
                policy.leaveApprovalSteps === 2
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              Leave: {policy.leaveApprovalSteps}-step approval
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              Rates: {policy.overtimeRateWeekday}× /{" "}
              {policy.overtimeRateWeekend}× / {policy.overtimeRateHoliday}×
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            title={expanded ? "Collapse" : "Expand details"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="Edit policy"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
            title="Delete policy"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm bg-gray-50 rounded-b-lg">
          {/* Overtime */}
          <div>
            <p className="font-medium text-gray-700 mb-2">Overtime</p>
            <div className="space-y-1 text-gray-600">
              <div>
                Mode:{" "}
                <strong>
                  {policy.overtimeMode === "pre"
                    ? "Pre-approval required"
                    : "Post-submission"}
                </strong>
              </div>
              {policy.overtimeMode === "post" && (
                <div>
                  Window:{" "}
                  <strong>{policy.overtimeSubmissionWindowDays} days</strong>
                </div>
              )}
              {policy.overtimeMode === "pre" && (
                <div>
                  Late submission:{" "}
                  <strong>
                    {policy.overtimeAllowLateSubmission
                      ? "Allowed"
                      : "Not allowed"}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Leave */}
          <div>
            <p className="font-medium text-gray-700 mb-2">Leave Approval</p>
            <div className="space-y-1 text-gray-600">
              <div>
                Steps: <strong>{policy.leaveApprovalSteps}</strong>
              </div>
              <div>
                Step 1: <strong>{step1}</strong>
              </div>
              {policy.leaveApprovalSteps >= 2 && (
                <div>
                  Step 2: <strong>{step2}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Pay rates & Attendance */}
          <div>
            <p className="font-medium text-gray-700 mb-2">
              Pay Rates & Attendance
            </p>
            <div className="space-y-1 text-gray-600">
              <div>
                Weekday OT: <strong>{policy.overtimeRateWeekday}×</strong>
              </div>
              <div>
                Weekend OT: <strong>{policy.overtimeRateWeekend}×</strong>
              </div>
              <div>
                Holiday OT: <strong>{policy.overtimeRateHoliday}×</strong>
              </div>
              <div>
                Late tolerance:{" "}
                <strong>{policy.lateToleranceMinutes} min</strong>
              </div>
            </div>
          </div>

          {policy.notes && (
            <div className="col-span-full text-gray-500 italic text-xs border-t border-gray-200 pt-3">
              {policy.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Policy Modal (Create / Edit) ────────────────────────────────────────────

function PolicyModal({
  editing,
  groups,
  entities,
  coveredGroupIds,
  coveredEntityIds,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => {
    if (!editing) return { ...DEFAULT_FORM };

    return {
      scopeType: editing.entityGroupId ? "group" : "entity",
      entityGroupId: editing.entityGroupId || "",
      entityId: editing.entityId || "",
      label: editing.label || "",
      overtimeMode: editing.overtimeMode,
      overtimeSubmissionWindowDays: editing.overtimeSubmissionWindowDays,
      overtimeAllowLateSubmission: editing.overtimeAllowLateSubmission,
      leaveApprovalSteps: editing.leaveApprovalSteps,
      leaveStep1Approvers: Array.isArray(editing.leaveStep1Approvers)
        ? editing.leaveStep1Approvers
        : (editing.leaveStep1Approvers || "").split(",").map((s) => s.trim()),
      leaveStep2Approvers: Array.isArray(editing.leaveStep2Approvers)
        ? editing.leaveStep2Approvers
        : (editing.leaveStep2Approvers || "").split(",").map((s) => s.trim()),
      overtimeRateWeekday: editing.overtimeRateWeekday,
      overtimeRateWeekend: editing.overtimeRateWeekend,
      overtimeRateHoliday: editing.overtimeRateHoliday,
      lateToleranceMinutes: editing.lateToleranceMinutes,
      internalPolicyUrl: editing.internalPolicyUrl || "",
      notes: editing.notes || "",
    };
  });

  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleApprover = (field, val) => {
    setForm((f) => {
      const current = f[field];
      return {
        ...f,
        [field]: current.includes(val)
          ? current.filter((v) => v !== val)
          : [...current, val],
      };
    });
  };

  const availableGroups = groups.filter(
    (g) => !coveredGroupIds.has(g.id) || editing?.entityGroupId === g.id,
  );
  const availableEntities = entities.filter(
    (e) => !coveredEntityIds.has(e.id) || editing?.entityId === e.id,
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.scopeType === "group" && !form.entityGroupId)
      return alert("Please select a group");
    if (form.scopeType === "entity" && !form.entityId)
      return alert("Please select an entity");
    if (form.leaveStep1Approvers.length === 0)
      return alert("At least one Step 1 approver is required");

    const payload = {
      entityGroupId: form.scopeType === "group" ? form.entityGroupId : null,
      entityId: form.scopeType === "entity" ? form.entityId : null,
      label: form.label,
      overtimeMode: form.overtimeMode,
      overtimeSubmissionWindowDays: Number(form.overtimeSubmissionWindowDays),
      overtimeAllowLateSubmission: form.overtimeAllowLateSubmission,
      leaveApprovalSteps: Number(form.leaveApprovalSteps),
      leaveStep1Approvers: form.leaveStep1Approvers,
      leaveStep2Approvers: form.leaveStep2Approvers,
      overtimeRateWeekday: Number(form.overtimeRateWeekday),
      overtimeRateWeekend: Number(form.overtimeRateWeekend),
      overtimeRateHoliday: Number(form.overtimeRateHoliday),
      lateToleranceMinutes: Number(form.lateToleranceMinutes),
      internalPolicyUrl: form.internalPolicyUrl || null,
      notes: form.notes,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiClient.put(`/entity-policies/${editing.id}`, payload);
      } else {
        await apiClient.post("/entity-policies", payload);
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Edit Policy" : "New Policy"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-6"
        >
          {/* Scope */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Scope</h3>
            <div className="flex gap-4 mb-3">
              {["group", "entity"].map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="scopeType"
                    value={type}
                    checked={form.scopeType === type}
                    onChange={() => set("scopeType", type)}
                    disabled={!!editing}
                  />
                  <span className="text-sm capitalize">
                    {type === "group" ? "Entity Group" : "Specific Entity"}
                  </span>
                </label>
              ))}
            </div>

            {form.scopeType === "group" ? (
              <select
                value={form.entityGroupId}
                onChange={(e) => set("entityGroupId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!!editing}
                required
              >
                <option value="">Select group…</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={form.entityId}
                onChange={(e) => set("entityId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={!!editing}
                required
              >
                <option value="">Select entity…</option>
                {availableEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.code})
                  </option>
                ))}
              </select>
            )}

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                Policy label (optional)
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="e.g. KGI Standard Policy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </section>

          <hr />

          {/* Overtime */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Overtime Rules
            </h3>
            <div className="flex gap-6 mb-4">
              {[
                {
                  val: "post",
                  label: "Post-submission",
                  desc: "Submit after the fact, within a time window",
                },
                {
                  val: "pre",
                  label: "Pre-approval",
                  desc: "Must submit a plan before doing overtime",
                },
              ].map(({ val, label, desc }) => (
                <label
                  key={val}
                  className={`flex-1 border-2 rounded-lg p-3 cursor-pointer transition-colors ${
                    form.overtimeMode === val
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="overtimeMode"
                    value={val}
                    checked={form.overtimeMode === val}
                    onChange={() => set("overtimeMode", val)}
                    className="sr-only"
                  />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-1">{desc}</p>
                </label>
              ))}
            </div>

            {form.overtimeMode === "post" && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Submission window (days after overtime date)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.overtimeSubmissionWindowDays}
                  onChange={(e) =>
                    set("overtimeSubmissionWindowDays", e.target.value)
                  }
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}

            {form.overtimeMode === "pre" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overtimeAllowLateSubmission}
                  onChange={(e) =>
                    set("overtimeAllowLateSubmission", e.target.checked)
                  }
                />
                Allow late (after-the-fact) submission if pre-approval was
                skipped
              </label>
            )}
          </section>

          <hr />

          {/* Leave */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Leave Approval
            </h3>
            <div className="flex gap-6 mb-4">
              {[
                {
                  val: 1,
                  label: "1-Step",
                  desc: "Any step 1 approver can fully approve",
                },
                {
                  val: 2,
                  label: "2-Step",
                  desc: "Step 1 approves first, then step 2",
                },
              ].map(({ val, label, desc }) => (
                <label
                  key={val}
                  className={`flex-1 border-2 rounded-lg p-3 cursor-pointer transition-colors ${
                    form.leaveApprovalSteps === val
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="leaveApprovalSteps"
                    value={val}
                    checked={form.leaveApprovalSteps === val}
                    onChange={() => set("leaveApprovalSteps", val)}
                    className="sr-only"
                  />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-1">{desc}</p>
                </label>
              ))}
            </div>

            {/* Step 1 approvers */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">
                Step 1 approvers (select at least one)
              </p>
              <div className="flex gap-3">
                {APPROVER_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.leaveStep1Approvers.includes(value)}
                      onChange={() =>
                        toggleApprover("leaveStep1Approvers", value)
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2 approvers (only shown for 2-step) */}
            {form.leaveApprovalSteps === 2 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Step 2 approvers</p>
                <div className="flex gap-3">
                  {APPROVER_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-1.5 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.leaveStep2Approvers.includes(value)}
                        onChange={() =>
                          toggleApprover("leaveStep2Approvers", value)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <hr />

          {/* Pay rates */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Overtime Pay Rates
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: "overtimeRateWeekday", label: "Weekday" },
                { key: "overtimeRateWeekend", label: "Weekend" },
                { key: "overtimeRateHoliday", label: "Holiday" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {label} multiplier
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                      ×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr />

          {/* Attendance */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Attendance
            </h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Late tolerance (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={form.lateToleranceMinutes}
                onChange={(e) => set("lateToleranceMinutes", e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </section>

          {/* Internal Policy URL */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Internal Policy Document URL
            </label>
            <input
              type="url"
              value={form.internalPolicyUrl}
              onChange={(e) => set("internalPolicyUrl", e.target.value)}
              placeholder="https://drive.google.com/... or https://notion.so/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Link to your HR policy document (Google Drive, Notion, Confluence,
              etc.). This will appear as an "Internal Policy" link in the
              sidebar for all employees in this entity/group.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Notes (internal)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Any notes about this policy…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
