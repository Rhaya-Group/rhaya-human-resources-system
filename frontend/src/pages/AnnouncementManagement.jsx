// frontend/src/pages/AnnouncementManagement.jsx
import { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../api/client';
import { useAuth } from '../hooks/useAuth';

const ACCESS_LEVEL_OPTIONS = [
  { value: 1, label: 'Level 1 — System Admin' },
  { value: 2, label: 'Level 2 — Subsidiary HR' },
  { value: 3, label: 'Level 3 — Manager' },
  { value: 4, label: 'Level 4 — Staff' },
  { value: 5, label: 'Level 5 — Intern' },
];

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#d1d5db',
    '&:hover': { borderColor: '#9ca3af' },
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

const emptyForm = {
  title: '',
  body: '',
  isPinned: false,
  expiresAt: '',
  targetAccessLevels: [],
  targetEntityIds: [],
  targetGroupIds: [],
  targetSubgroupIds: [],
  targetDivisionIds: [],
};

export default function AnnouncementManagement() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [entities, setEntities] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const entityEndpoint = user?.accessLevel === 1 ? '/plotting-companies' : '/users/accessible-entities';
      const [annRes, entityRes, groupRes, subgroupRes, divRes] = await Promise.all([
        apiClient.get('/announcements/manage'),
        apiClient.get(entityEndpoint),
        apiClient.get('/entity-groups'),
        apiClient.get('/entity-subgroups'),
        apiClient.get('/divisions'),
      ]);
      setAnnouncements(annRes.data.data || []);
      setEntities(entityRes.data.data || []);
      setGroups(groupRes.data.data || []);
      setSubgroups(subgroupRes.data.data || []);
      setDivisions(divRes.data.data || []);
    } catch (error) {
      console.error('Fetch announcements error:', error);
      alert('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      body: announcement.body,
      isPinned: announcement.isPinned,
      expiresAt: announcement.expiresAt ? announcement.expiresAt.split('T')[0] : '',
      targetAccessLevels: announcement.targetAccessLevels || [],
      targetEntityIds: announcement.targetEntityIds || [],
      targetGroupIds: announcement.targetGroupIds || [],
      targetSubgroupIds: announcement.targetSubgroupIds || [],
      targetDivisionIds: announcement.targetDivisionIds || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('Title and body are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        expiresAt: formData.expiresAt || null,
      };

      if (editingId) {
        await apiClient.put(`/announcements/${editingId}`, payload);
      } else {
        await apiClient.post('/announcements', payload);
      }

      setShowModal(false);
      fetchAll();
    } catch (error) {
      console.error('Save announcement error:', error);
      alert(error.response?.data?.error || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete announcement: "${title}"?`)) return;
    try {
      await apiClient.delete(`/announcements/${id}`);
      fetchAll();
    } catch (error) {
      console.error('Delete announcement error:', error);
      alert(error.response?.data?.error || 'Failed to delete announcement');
    }
  };

  const entityOptions = entities.map((e) => ({ value: e.id, label: e.name }));
  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));
  const subgroupOptions = subgroups.map((s) => ({
    value: s.id,
    label: s.group?.name ? `${s.name} (${s.group.name})` : s.name,
  }));
  const divisionOptions = divisions.map((d) => ({ value: d.id, label: d.name }));

  const describeTargeting = (a) => {
    const parts = [];
    if (a.targetAccessLevels?.length > 0) {
      parts.push(`Levels ${a.targetAccessLevels.join(', ')}`);
    }
    if (a.targetEntityIds?.length > 0) {
      const names = a.targetEntityIds
        .map((id) => entities.find((e) => e.id === id)?.name)
        .filter(Boolean);
      parts.push(names.length > 0 ? names.join(', ') : `${a.targetEntityIds.length} entit${a.targetEntityIds.length === 1 ? 'y' : 'ies'}`);
    }
    if (a.targetGroupIds?.length > 0) {
      const names = a.targetGroupIds
        .map((id) => groups.find((g) => g.id === id)?.name)
        .filter(Boolean);
      parts.push(names.length > 0 ? names.join(', ') : `${a.targetGroupIds.length} group(s)`);
    }
    if (a.targetSubgroupIds?.length > 0) {
      const names = a.targetSubgroupIds
        .map((id) => subgroups.find((s) => s.id === id)?.name)
        .filter(Boolean);
      parts.push(names.length > 0 ? names.join(', ') : `${a.targetSubgroupIds.length} subgroup(s)`);
    }
    if (a.targetDivisionIds?.length > 0) {
      const names = a.targetDivisionIds
        .map((id) => divisions.find((d) => d.id === id)?.name)
        .filter(Boolean);
      parts.push(names.length > 0 ? names.join(', ') : `${a.targetDivisionIds.length} division(s)`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Everyone';
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-600 mt-1">Post announcements and control who can see them</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Announcement
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center py-12">
          <p className="text-gray-500">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.isPinned && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                        Pinned
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{a.body}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Visible to: {describeTargeting(a)}</span>
                    {a.expiresAt && <span>Expires {formatDate(a.expiresAt)}</span>}
                    <span>Posted by {a.createdBy?.name} on {formatDate(a.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => openEditModal(a)} className="text-green-600 hover:text-green-900" title="Edit">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(a.id, a.title)} className="text-red-600 hover:text-red-900" title="Delete">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g. Office closed for national holiday"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Announcement details..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible to (access levels)
                </label>
                <Select
                  isMulti
                  value={ACCESS_LEVEL_OPTIONS.filter((o) => formData.targetAccessLevels.includes(o.value))}
                  onChange={(options) =>
                    setFormData({ ...formData, targetAccessLevels: (options || []).map((o) => o.value) })
                  }
                  options={ACCESS_LEVEL_OPTIONS}
                  styles={selectStyles}
                  placeholder="All access levels (leave empty for everyone)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible to (entities)
                </label>
                <Select
                  isMulti
                  value={entityOptions.filter((o) => formData.targetEntityIds.includes(o.value))}
                  onChange={(options) =>
                    setFormData({ ...formData, targetEntityIds: (options || []).map((o) => o.value) })
                  }
                  options={entityOptions}
                  styles={selectStyles}
                  placeholder="All entities (leave empty for everyone)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible to (entity groups)
                </label>
                <Select
                  isMulti
                  value={groupOptions.filter((o) => formData.targetGroupIds.includes(o.value))}
                  onChange={(options) =>
                    setFormData({ ...formData, targetGroupIds: (options || []).map((o) => o.value) })
                  }
                  options={groupOptions}
                  styles={selectStyles}
                  placeholder="All groups (leave empty for everyone)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible to (entity subgroups)
                </label>
                <Select
                  isMulti
                  value={subgroupOptions.filter((o) => formData.targetSubgroupIds.includes(o.value))}
                  onChange={(options) =>
                    setFormData({ ...formData, targetSubgroupIds: (options || []).map((o) => o.value) })
                  }
                  options={subgroupOptions}
                  styles={selectStyles}
                  placeholder="All subgroups (leave empty for everyone)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible to (divisions)
                </label>
                <Select
                  isMulti
                  value={divisionOptions.filter((o) => formData.targetDivisionIds.includes(o.value))}
                  onChange={(options) =>
                    setFormData({ ...formData, targetDivisionIds: (options || []).map((o) => o.value) })
                  }
                  options={divisionOptions}
                  styles={selectStyles}
                  placeholder="All divisions (leave empty for everyone)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <p className="text-xs text-gray-500">
                An employee sees this announcement only if they match every dimension you set above. Leave a dimension empty to not restrict by it. Leave everything empty to show it to all employees.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="isPinned"
                    type="checkbox"
                    checked={formData.isPinned}
                    onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isPinned" className="text-sm font-medium text-gray-700">
                    Pin to top
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expires on</label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
