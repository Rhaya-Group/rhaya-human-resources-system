// frontend/src/pages/PolicyTemplateManagement.jsx
import { useState, useEffect } from 'react';
import {
  Shield, Plus, Edit2, Trash2, ChevronDown, ChevronUp,
  Link, Tag, Building2, Users, X, Info, Mail, Server, Image, Upload,
} from 'lucide-react';
import apiClient from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const APPROVER_OPTIONS = [
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'dept_head',  label: 'Dept Head'  },
  { value: 'hr',         label: 'HR'          },
];

const BLANK_TEMPLATE = {
  name: '',
  description: '',
  overtimeMode: 'post',
  overtimeSubmissionWindowDays: 7,
  overtimeAllowLateSubmission: false,
  leaveApprovalSteps: 1,
  leaveStep1Approvers: ['supervisor', 'dept_head', 'hr'],
  leaveStep2Approvers: ['hr'],
  overtimeRateWeekday: 1.5,
  overtimeRateWeekend: 2.0,
  overtimeRateHoliday: 3.0,
  lateToleranceMinutes: 15,
  internalPolicyUrl: '',
  hrEmail: '',
  smtpProfile: '',
  notes: '',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PolicyTemplateManagement() {
  const [templates,    setTemplates]    = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [entities,     setEntities]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showTplModal, setShowTplModal] = useState(false);
  const [showAsnModal, setShowAsnModal] = useState(false);
  const [editingTpl,   setEditingTpl]   = useState(null);  // template being edited
  const [assigningTpl, setAssigningTpl] = useState(null);  // template to assign

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [tplRes, grpRes, entRes] = await Promise.all([
        apiClient.get('/policy-templates'),
        apiClient.get('/entity-groups'),
        apiClient.get('/plotting-companies'),
      ]);
      setTemplates(tplRes.data.data  || []);
      setGroups(grpRes.data.data     || []);
      setEntities(entRes.data.data   || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTemplate(tpl) {
    if (!confirm(`Delete template "${tpl.name}"?\n\nAll its assignments must be removed first.`)) return;
    try {
      await apiClient.delete(`/policy-templates/${tpl.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete template');
    }
  }

  async function handleDeleteAssignment(tpl, asnId) {
    if (!confirm('Remove this assignment?')) return;
    try {
      await apiClient.delete(`/policy-templates/assignments/${asnId}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove assignment');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Policy Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create named rule sets, then assign them to any entity or group.
            When multiple assignments match, higher priority wins.
          </p>
        </div>
        <button
          onClick={() => { setEditingTpl(null); setShowTplModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Priority legend */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Priority rules:</strong> When an entity matches multiple assignments
          (e.g. a direct assignment AND its group's assignment), the one with the
          <strong> highest priority number</strong> wins entirely. Default priority is 10.
          Use higher numbers (20, 30…) for more specific overrides.
        </div>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Shield className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No policy templates yet.</p>
          <button
            onClick={() => { setEditingTpl(null); setShowTplModal(true); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => { setEditingTpl(tpl); setShowTplModal(true); }}
              onDelete={() => handleDeleteTemplate(tpl)}
              onAssign={() => { setAssigningTpl(tpl); setShowAsnModal(true); }}
              onDeleteAssignment={(asnId) => handleDeleteAssignment(tpl, asnId)}
            />
          ))}
        </div>
      )}

      {/* Template create/edit modal */}
      {showTplModal && (
        <TemplateModal
          editing={editingTpl}
          onClose={() => setShowTplModal(false)}
          onSaved={() => { setShowTplModal(false); fetchAll(); }}
        />
      )}

      {/* Assignment modal */}
      {showAsnModal && assigningTpl && (
        <AssignmentModal
          template={assigningTpl}
          groups={groups}
          entities={entities}
          existingAssignments={assigningTpl.assignments || []}
          onClose={() => setShowAsnModal(false)}
          onSaved={() => { setShowAsnModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onEdit, onDelete, onAssign, onDeleteAssignment }) {
  const [expanded, setExpanded] = useState(false);

  const assignments = template.assignments || [];
  const entityAssignments = assignments.filter(a => a.entityId);
  const groupAssignments  = assignments.filter(a => a.entityGroupId);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header row */}
      <div className="p-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900">{template.name}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {template._count?.assignments ?? assignments.length} assignment(s)
            </span>
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mb-2">{template.description}</p>
          )}

          {/* Quick badges */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded font-medium ${
              template.overtimeMode === 'pre'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              OT: {template.overtimeMode === 'pre' ? 'Pre-approval' : `Post H+${template.overtimeSubmissionWindowDays}`}
            </span>
            <span className={`px-2 py-0.5 rounded font-medium ${
              template.leaveApprovalSteps === 2
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              Leave: {template.leaveApprovalSteps}-step
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {template.overtimeRateWeekday}× / {template.overtimeRateWeekend}× / {template.overtimeRateHoliday}×
            </span>
            {template.internalPolicyUrl && (
              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded flex items-center gap-1">
                <Link className="w-3 h-3" /> Policy URL set
              </span>
            )}
            {template.hrEmail && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded flex items-center gap-1">
                <Mail className="w-3 h-3" /> {template.hrEmail}
              </span>
            )}
            {template.smtpProfile && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded flex items-center gap-1">
                <Server className="w-3 h-3" /> SMTP: {template.smtpProfile}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onAssign}
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200"
            title="Assign to entities/groups"
          >
            + Assign
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onEdit}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded: details + assignments */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 rounded-b-lg">
          {/* Rule details */}
          <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm border-b border-gray-200">
            <div>
              <p className="font-medium text-gray-700 mb-1">Overtime</p>
              <div className="space-y-0.5 text-gray-600 text-xs">
                <div>Mode: <strong>{template.overtimeMode === 'pre' ? 'Pre-approval' : 'Post-submission'}</strong></div>
                {template.overtimeMode === 'post' && <div>Window: <strong>{template.overtimeSubmissionWindowDays}d</strong></div>}
                {template.overtimeMode === 'pre'  && <div>Late allowed: <strong>{template.overtimeAllowLateSubmission ? 'Yes' : 'No'}</strong></div>}
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Leave</p>
              <div className="space-y-0.5 text-gray-600 text-xs">
                <div>Steps: <strong>{template.leaveApprovalSteps}</strong></div>
                <div>Step 1: <strong>{template.leaveStep1Approvers}</strong></div>
                {template.leaveApprovalSteps >= 2 && <div>Step 2: <strong>{template.leaveStep2Approvers}</strong></div>}
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">Rates & Attendance</p>
              <div className="space-y-0.5 text-gray-600 text-xs">
                <div>Weekday: <strong>{template.overtimeRateWeekday}×</strong></div>
                <div>Weekend: <strong>{template.overtimeRateWeekend}×</strong></div>
                <div>Holiday: <strong>{template.overtimeRateHoliday}×</strong></div>
                <div>Late tolerance: <strong>{template.lateToleranceMinutes}min</strong></div>
              </div>
            </div>
          </div>

          {/* Assignments list */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Assigned to ({assignments.length})
            </p>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Not assigned anywhere yet. Click "+ Assign" to add targets.
              </p>
            ) : (
              <div className="space-y-1.5">
                {/* Group assignments */}
                {groupAssignments.map(a => (
                  <div key={a.id}
                    className="flex items-center gap-3 py-1.5 px-3 bg-white rounded border border-gray-200"
                  >
                    <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${a.entityGroup?.color}20`, color: a.entityGroup?.color }}
                    >
                      {a.entityGroup?.name}
                    </span>
                    <span className="text-xs text-gray-400">group</span>
                    <span className="ml-auto text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      priority {a.priority}
                    </span>
                    {a.label && <span className="text-xs text-gray-500 italic">{a.label}</span>}
                    <button onClick={() => onDeleteAssignment(a.id)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Entity assignments */}
                {entityAssignments.map(a => (
                  <div key={a.id}
                    className="flex items-center gap-3 py-1.5 px-3 bg-white rounded border border-gray-200"
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      {a.entity?.code}
                    </span>
                    <span className="text-xs text-gray-700 truncate">{a.entity?.name}</span>
                    <span className="ml-auto text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                      priority {a.priority}
                    </span>
                    {a.label && <span className="text-xs text-gray-500 italic">{a.label}</span>}
                    <button onClick={() => onDeleteAssignment(a.id)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Modal ───────────────────────────────────────────────────────────

function TemplateModal({ editing, onClose, onSaved }) {
  const [form, setForm]   = useState(() => editing
    ? {
        name:                         editing.name,
        description:                  editing.description || '',
        overtimeMode:                 editing.overtimeMode,
        overtimeSubmissionWindowDays: editing.overtimeSubmissionWindowDays,
        overtimeAllowLateSubmission:  editing.overtimeAllowLateSubmission,
        leaveApprovalSteps:           editing.leaveApprovalSteps,
        leaveStep1Approvers:          typeof editing.leaveStep1Approvers === 'string'
                                        ? editing.leaveStep1Approvers.split(',').map(s=>s.trim())
                                        : editing.leaveStep1Approvers,
        leaveStep2Approvers:          typeof editing.leaveStep2Approvers === 'string'
                                        ? editing.leaveStep2Approvers.split(',').map(s=>s.trim())
                                        : editing.leaveStep2Approvers,
        overtimeRateWeekday:          editing.overtimeRateWeekday,
        overtimeRateWeekend:          editing.overtimeRateWeekend,
        overtimeRateHoliday:          editing.overtimeRateHoliday,
        lateToleranceMinutes:         editing.lateToleranceMinutes,
        internalPolicyUrl:            editing.internalPolicyUrl || '',
        hrEmail:                      editing.hrEmail || '',
        smtpProfile:                  editing.smtpProfile || '',
        notes:                        editing.notes || '',
      }
    : { ...BLANK_TEMPLATE }
  );
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoLoading, setLogoLoading] = useState(!!editing);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    apiClient.get(`/policy-templates/${editing.id}/logo`)
      .then(res => { if (!cancelled) setLogoUrl(res.data.data?.url || null); })
      .catch(() => { if (!cancelled) setLogoUrl(null); })
      .finally(() => { if (!cancelled) setLogoLoading(false); });
    return () => { cancelled = true; };
  }, [editing]);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      alert('Logo must be PNG or JPEG');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB');
      e.target.value = '';
      return;
    }
    try {
      setLogoUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/policy-templates/${editing.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await apiClient.get(`/policy-templates/${editing.id}/logo`);
      setLogoUrl(res.data.data?.url || null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  }

  async function handleLogoRemove() {
    if (!confirm('Remove this template\'s payslip logo? Payslips will fall back to the default logo.')) return;
    try {
      setLogoUploading(true);
      await apiClient.delete(`/policy-templates/${editing.id}/logo`);
      setLogoUrl(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove logo');
    } finally {
      setLogoUploading(false);
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleApprover = (field, val) => setForm(f => ({
    ...f,
    [field]: f[field].includes(val)
      ? f[field].filter(x => x !== val)
      : [...f[field], val],
  }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())                       return alert('Name is required');
    if (form.leaveStep1Approvers.length === 0)   return alert('At least one Step 1 approver required');

    const payload = {
      ...form,
      overtimeSubmissionWindowDays: Number(form.overtimeSubmissionWindowDays),
      leaveApprovalSteps:           Number(form.leaveApprovalSteps),
      overtimeRateWeekday:          Number(form.overtimeRateWeekday),
      overtimeRateWeekend:          Number(form.overtimeRateWeekend),
      overtimeRateHoliday:          Number(form.overtimeRateHoliday),
      lateToleranceMinutes:         Number(form.lateToleranceMinutes),
      internalPolicyUrl:            form.internalPolicyUrl || null,
      hrEmail:                      form.hrEmail || null,
      smtpProfile:                  form.smtpProfile || null,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiClient.put(`/policy-templates/${editing.id}`, payload);
      } else {
        await apiClient.post('/policy-templates', payload);
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">
            {editing ? 'Edit Template' : 'New Policy Template'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Template Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. KGI Standard Policy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <hr />

          {/* Overtime */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Overtime</h3>
            <div className="flex gap-4 mb-3">
              {[
                { val: 'post', label: 'Post-submission', desc: 'Submit after the fact within a window' },
                { val: 'pre',  label: 'Pre-approval',   desc: 'Must plan before doing overtime' },
              ].map(({ val, label, desc }) => (
                <label key={val} className={`flex-1 border-2 rounded-lg p-3 cursor-pointer ${
                  form.overtimeMode === val ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <input type="radio" name="overtimeMode" value={val}
                    checked={form.overtimeMode === val} onChange={() => set('overtimeMode', val)}
                    className="sr-only" />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-1">{desc}</p>
                </label>
              ))}
            </div>
            {form.overtimeMode === 'post' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Submission window (days)</label>
                <input type="number" min={1} max={30} value={form.overtimeSubmissionWindowDays}
                  onChange={e => set('overtimeSubmissionWindowDays', e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}
            {form.overtimeMode === 'pre' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.overtimeAllowLateSubmission}
                  onChange={e => set('overtimeAllowLateSubmission', e.target.checked)} />
                Allow late submission if pre-approval was skipped
              </label>
            )}
          </div>

          <hr />

          {/* Leave */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Leave Approval</h3>
            <div className="flex gap-4 mb-4">
              {[
                { val: 1, label: '1-Step', desc: 'Any step 1 approver can fully approve' },
                { val: 2, label: '2-Step', desc: 'Step 1 then step 2 must both approve' },
              ].map(({ val, label, desc }) => (
                <label key={val} className={`flex-1 border-2 rounded-lg p-3 cursor-pointer ${
                  form.leaveApprovalSteps === val ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <input type="radio" name="leaveApprovalSteps" value={val}
                    checked={form.leaveApprovalSteps === val} onChange={() => set('leaveApprovalSteps', val)}
                    className="sr-only" />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-1">{desc}</p>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Step 1 approvers</p>
                <div className="flex gap-4">
                  {APPROVER_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={form.leaveStep1Approvers.includes(value)}
                        onChange={() => toggleApprover('leaveStep1Approvers', value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {form.leaveApprovalSteps === 2 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Step 2 approvers</p>
                  <div className="flex gap-4">
                    {APPROVER_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="checkbox"
                          checked={form.leaveStep2Approvers.includes(value)}
                          onChange={() => toggleApprover('leaveStep2Approvers', value)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr />

          {/* Pay rates */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Overtime Pay Rates</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: 'overtimeRateWeekday', label: 'Weekday' },
                { k: 'overtimeRateWeekend', label: 'Weekend' },
                { k: 'overtimeRateHoliday', label: 'Holiday' },
              ].map(({ k, label }) => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 mb-1">{label} ×</label>
                  <input type="number" step="0.5" min="1" max="10" value={form[k]}
                    onChange={e => set(k, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              ))}
            </div>
          </div>

          <hr />

          {/* Misc */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Late tolerance (minutes)</label>
              <input type="number" min={0} max={60} value={form.lateToleranceMinutes}
                onChange={e => set('lateToleranceMinutes', e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Internal Policy Document URL</label>
              <input type="url" value={form.internalPolicyUrl}
                onChange={e => set('internalPolicyUrl', e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">Shown in sidebar for employees under this template.</p>
            </div>

            <hr />

            {/* Payslip Logo */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-indigo-500" />
                Payslip Logo
              </h3>
              {!editing ? (
                <p className="text-xs text-gray-400">Save the template first, then come back to upload a logo.</p>
              ) : logoLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : (
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Payslip logo" className="h-12 w-auto max-w-[160px] object-contain border border-gray-200 rounded-lg p-1 bg-white" />
                  ) : (
                    <div className="h-12 w-24 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-xs text-gray-400">
                      No logo
                    </div>
                  )}
                  <label className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {logoUploading ? 'Uploading...' : logoUrl ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/png,image/jpeg" className="hidden"
                      onChange={handleLogoUpload} disabled={logoUploading} />
                  </label>
                  {logoUrl && (
                    <button type="button" onClick={handleLogoRemove} disabled={logoUploading}
                      className="text-red-500 hover:text-red-700 text-sm">
                      Remove
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">PNG or JPEG, under 2MB. Falls back to the default logo if not set. Used on payslips for entities under this template.</p>
            </div>

            <hr />

            {/* HR Contact & SMTP */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-pink-500" />
                HR Contact & Email
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    HR Email for notifications
                  </label>
                  <input
                    type="email"
                    value={form.hrEmail}
                    onChange={e => set('hrEmail', e.target.value)}
                    placeholder="hr@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Notification emails for leave / overtime under this policy go to this address.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Server className="w-3 h-3" /> SMTP Profile key
                  </label>
                  <input
                    type="text"
                    value={form.smtpProfile}
                    onChange={e => set('smtpProfile', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. kgi  →  SMTP2GO_KGI_USER / PASS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Maps to env vars <code className="bg-gray-100 px-1 rounded">SMTP2GO_{'<KEY>'}_USER</code> / <code className="bg-gray-100 px-1 rounded">SMTP2GO_{'<KEY>'}_PASS</code> / <code className="bg-gray-100 px-1 rounded">FROM_EMAIL</code>.
                    Leave blank to use default SMTP account.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </form>

        <div className="flex gap-3 p-5 border-t">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={saving}>Cancel</button>
          <button onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignment Modal ─────────────────────────────────────────────────────────
// Select multiple entities and/or groups + set priority for each

function AssignmentModal({ template, groups, entities, existingAssignments, onClose, onSaved }) {
  // Already-assigned IDs for this template
  const assignedEntityIds = new Set(existingAssignments.filter(a=>a.entityId).map(a=>a.entityId));
  const assignedGroupIds  = new Set(existingAssignments.filter(a=>a.entityGroupId).map(a=>a.entityGroupId));

  const [tab, setTab]         = useState('entities'); // 'entities' | 'groups'
  const [selected, setSelected] = useState([]); // [{ entityId|entityGroupId, priority, label }]
  const [priority, setPriority] = useState(10);
  const [label, setLabel]       = useState('');
  const [saving, setSaving]     = useState(false);

  function toggleEntity(id) {
    setSelected(prev => {
      if (prev.find(s => s.entityId === id)) return prev.filter(s => s.entityId !== id);
      return [...prev, { entityId: id }];
    });
  }

  function toggleGroup(id) {
    setSelected(prev => {
      if (prev.find(s => s.entityGroupId === id)) return prev.filter(s => s.entityGroupId !== id);
      return [...prev, { entityGroupId: id }];
    });
  }

  function isSelectedEntity(id) { return !!selected.find(s => s.entityId === id); }
  function isSelectedGroup(id)  { return !!selected.find(s => s.entityGroupId === id); }

  async function handleSave() {
    if (selected.length === 0) return alert('Select at least one entity or group');

    const targets = selected.map(s => ({
      ...s,
      priority: Number(priority),
      label: label || null,
    }));

    try {
      setSaving(true);
      await apiClient.post('/policy-templates/assignments', {
        templateId: template.id,
        targets,
      });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create assignments');
    } finally {
      setSaving(false);
    }
  }

  const availableEntities = entities.filter(e => !assignedEntityIds.has(e.id));
  const availableGroups   = groups.filter(g => !assignedGroupIds.has(g.id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold">Assign Template</h2>
            <p className="text-sm text-gray-500">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5 flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Priority & label */}
          <div className="flex gap-3">
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              <input type="number" min={1} max={100} value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">Higher wins</p>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Label (optional)</label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Override for KGI entities"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button type="button" onClick={() => setTab('entities')}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === 'entities' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
              }`}>
              <Building2 className="w-4 h-4 inline mr-1" />
              Entities ({selected.filter(s=>s.entityId).length} selected)
            </button>
            <button type="button" onClick={() => setTab('groups')}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === 'groups' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
              }`}>
              <Users className="w-4 h-4 inline mr-1" />
              Groups ({selected.filter(s=>s.entityGroupId).length} selected)
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {tab === 'entities' ? (
              availableEntities.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">All entities already assigned</p>
                : availableEntities.map(e => (
                    <label key={e.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg border border-gray-100 cursor-pointer"
                    >
                      <input type="checkbox"
                        checked={isSelectedEntity(e.id)}
                        onChange={() => toggleEntity(e.id)}
                        className="w-4 h-4 text-blue-600 rounded" />
                      <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                        {e.code}
                      </span>
                      <span className="text-sm text-gray-800 flex-1">{e.name}</span>
                      {e.group && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${e.group.color}20`, color: e.group.color }}>
                          {e.group.name}
                        </span>
                      )}
                    </label>
                  ))
            ) : (
              availableGroups.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">All groups already assigned</p>
                : availableGroups.map(g => (
                    <label key={g.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg border border-gray-100 cursor-pointer"
                    >
                      <input type="checkbox"
                        checked={isSelectedGroup(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="w-4 h-4 text-blue-600 rounded" />
                      <span className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color }} />
                      <span className="text-sm text-gray-800 flex-1">{g.name}</span>
                      <span className="text-xs text-gray-400">{g.code}</span>
                    </label>
                  ))
            )}
          </div>

          {/* Selected summary */}
          {selected.length > 0 && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
              {selected.length} target(s) selected · priority {priority}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={saving || selected.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Assigning…' : `Assign to ${selected.length} target(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
