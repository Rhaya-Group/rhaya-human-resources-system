// frontend/src/pages/EntitySubgroupManagement.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import { Users, X, Plus, Edit2, Trash2, Building2, ChevronDown, ChevronUp } from "lucide-react";

export default function EntitySubgroupManagement() {
  const { user, loading } = useAuth();
  const navigate           = useNavigate();
  const hasCheckedAccess   = useRef(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [subgroups,   setSubgroups]   = useState([]);
  const [groups,      setGroups]      = useState([]);   // EntityGroups for parent selector
  const [entities,    setEntities]    = useState([]);   // PlottingCompanies for assignment
  const [dataLoading, setDataLoading] = useState(true);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm,       setSearchTerm]       = useState("");
  const [groupFilter,      setGroupFilter]       = useState("");

  // ── Create/Edit modal ─────────────────────────────────────────────────────
  const [showModal,    setShowModal]    = useState(false);
  const [modalMode,    setModalMode]    = useState("create"); // "create" | "edit"
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData,     setFormData]     = useState({
    name:        "",
    code:        "",
    description: "",
    color:       "#6366F1",
    groupId:     "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Assign entities modal ─────────────────────────────────────────────────
  const [showAssignModal,    setShowAssignModal]    = useState(false);
  const [assigningSubgroup,  setAssigningSubgroup]  = useState(null);
  const [assignedEntityIds,  setAssignedEntityIds]  = useState([]);
  const [isAssigning,        setIsAssigning]        = useState(false);

  // ── Employee list modal ───────────────────────────────────────────────────
  const [showEmployeeModal,   setShowEmployeeModal]   = useState(false);
  const [employeeList,        setEmployeeList]        = useState([]);
  const [loadingEmployees,    setLoadingEmployees]    = useState(false);
  const [selectedSubgroupName, setSelectedSubgroupName] = useState("");

  // ── Access control ────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasCheckedAccess.current) return;
    if (loading) return;
    if (!user) { navigate("/login"); return; }
    if (user.accessLevel > 1) {
      hasCheckedAccess.current = true;
      alert("Access denied. Level 1 only.");
      navigate("/");
      return;
    }
    hasCheckedAccess.current = true;
    fetchAll();
  }, [user, loading, navigate]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      setDataLoading(true);
      const [subRes, grpRes, entRes] = await Promise.all([
        apiClient.get("/entity-subgroups"),
        apiClient.get("/entity-groups"),
        apiClient.get("/plotting-companies"),
      ]);
      setSubgroups(subRes.data.data || []);
      setGroups(grpRes.data.data   || []);
      setEntities(entRes.data.data || []);
    } catch (err) {
      console.error("fetchAll error:", err);
      alert("Failed to load data");
    } finally {
      setDataLoading(false);
    }
  };

  // ── Create / Edit ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setModalMode("create");
    setSelectedItem(null);
    setFormData({ name: "", code: "", description: "", color: "#6366F1", groupId: "" });
    setShowModal(true);
  };

  const openEdit = (subgroup) => {
    setModalMode("edit");
    setSelectedItem(subgroup);
    setFormData({
      name:        subgroup.name,
      code:        subgroup.code        || "",
      description: subgroup.description || "",
      color:       subgroup.color       || "#6366F1",
      groupId:     subgroup.groupId     || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name.trim()) return alert("Name is required");
    if (!formData.groupId)     return alert("Parent group is required");

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        await apiClient.post("/entity-subgroups", {
          ...formData,
          code: formData.code.toUpperCase() || undefined,
        });
        alert("Subgroup created successfully");
      } else {
        await apiClient.put(`/entity-subgroups/${selectedItem.id}`, {
          ...formData,
          code: formData.code.toUpperCase() || undefined,
        });
        alert("Subgroup updated successfully");
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save subgroup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (subgroup) => {
    const entityCount = subgroup._count?.companies ?? 0;
    if (entityCount > 0) {
      return alert(`Cannot delete "${subgroup.name}" — it has ${entityCount} entities assigned. Remove them first.`);
    }
    if (!confirm(`Delete subgroup "${subgroup.name}"?`)) return;
    try {
      await apiClient.delete(`/entity-subgroups/${subgroup.id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete subgroup");
    }
  };

  // ── Assign entities ────────────────────────────────────────────────────────
  const openAssign = (subgroup) => {
    setAssigningSubgroup(subgroup);
    // Pre-select currently assigned entities
    const currentIds = (subgroup.companies || []).map(c => c.id);
    setAssignedEntityIds(currentIds);
    setShowAssignModal(true);
  };

  const toggleEntity = (entityId) => {
    setAssignedEntityIds(prev =>
      prev.includes(entityId)
        ? prev.filter(id => id !== entityId)
        : [...prev, entityId]
    );
  };

  const handleSaveAssignments = async () => {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      await apiClient.put(
        `/entity-subgroups/${assigningSubgroup.id}/assign-entities`,
        { entityIds: assignedEntityIds }
      );
      alert("Entities assigned successfully");
      setShowAssignModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign entities");
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Employee list ──────────────────────────────────────────────────────────
  const fetchSubgroupEmployees = async (subgroup) => {
    setSelectedSubgroupName(subgroup.name);
    setLoadingEmployees(true);
    setShowEmployeeModal(true);

    try {
      const res = await apiClient.get(`/entity-subgroups/${subgroup.id}/employees`);
      const data = res.data;
      setEmployeeList(data.users || data.data || []);
    } catch (err) {
      console.error("Fetch employees error:", err);
      alert("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = subgroups.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.code || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup  = !groupFilter || s.groupId === groupFilter;
    return matchesSearch && matchesGroup;
  });

  // ── Entities available for assignment (not in any other subgroup,
  //    or already in THIS subgroup)
  const availableEntities = entities.filter(e =>
    !e.subgroupId || e.subgroupId === assigningSubgroup?.id
  );

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Subgroups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage subgroups within entity groups. Used for scoping leave notifications
            and organisation within a parent group.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Subgroup
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search subgroups..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">All Groups</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Subgroup list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No subgroups found.</p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Subgroup
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(subgroup => (
            <SubgroupCard
              key={subgroup.id}
              subgroup={subgroup}
              onEdit={() => openEdit(subgroup)}
              onDelete={() => handleDelete(subgroup)}
              onAssign={() => openAssign(subgroup)}
              onViewEmployees={() => fetchSubgroupEmployees(subgroup)}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">
                {modalMode === "create" ? "New Subgroup" : "Edit Subgroup"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Parent Group */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Group *
                </label>
                <select
                  value={formData.groupId}
                  onChange={e => setFormData({ ...formData, groupId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                >
                  <option value="">Select parent group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subgroup Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rhaya Flicks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code (optional)
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. RHAYA"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="#6366F1"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : modalMode === "create" ? "Create" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Entities Modal ─────────────────────────────────────────── */}
      {showAssignModal && assigningSubgroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">Assign Entities</h2>
                <p className="text-sm text-gray-500">
                  Subgroup: <span className="font-medium">{assigningSubgroup.name}</span>
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b bg-amber-50">
              <p className="text-xs text-amber-700">
                Only entities not yet in another subgroup are shown.
                Selecting an entity moves it here; deselecting removes it from this subgroup.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {availableEntities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No available entities</p>
              ) : (
                availableEntities.map(entity => (
                  <label
                    key={entity.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg border border-gray-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assignedEntityIds.includes(entity.id)}
                      onChange={() => toggleEntity(entity.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      {entity.code || "—"}
                    </span>
                    <span className="flex-1 text-sm text-gray-800">{entity.name}</span>
                    {entity.subgroupId === assigningSubgroup.id && (
                      <span className="text-xs text-green-600 font-medium">current</span>
                    )}
                  </label>
                ))
              )}
            </div>

            <div className="p-5 border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  {assignedEntityIds.length} entities selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignedEntityIds(availableEntities.map(e => e.id))}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setAssignedEntityIds([])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  disabled={isAssigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignments}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                  disabled={isAssigning}
                >
                  {isAssigning ? "Saving..." : "Save Assignments"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee List Modal ───────────────────────────────────────────── */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">Employees</h2>
                <p className="text-sm text-gray-500">{selectedSubgroupName}</p>
              </div>
              <button onClick={() => setShowEmployeeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingEmployees ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : employeeList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No employees found</p>
              ) : (
                <div className="space-y-2">
                  {employeeList.map((emp, i) => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{emp.name}</span>
                          {emp.nip && <span className="text-xs text-gray-400">({emp.nip})</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className="truncate">{emp.email}</span>
                          {emp.supervisor && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>SPV: {emp.supervisor.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {emp.plottingCompany && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                            {emp.plottingCompany.code}
                          </span>
                        )}
                        {emp.division && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {emp.division.name}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          emp.accessLevel === 1 ? "bg-purple-100 text-purple-800" :
                          emp.accessLevel === 2 ? "bg-blue-100 text-blue-800" :
                          emp.accessLevel === 3 ? "bg-green-100 text-green-800" :
                                                  "bg-gray-100 text-gray-800"
                        }`}>
                          L{emp.accessLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Total: <strong>{employeeList.length}</strong> employees
              </span>
              <button
                onClick={() => setShowEmployeeModal(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubgroupCard
// ─────────────────────────────────────────────────────────────────────────────

function SubgroupCard({ subgroup, onEdit, onDelete, onAssign, onViewEmployees }) {
  const [expanded, setExpanded] = useState(false);
  const entityCount   = subgroup._count?.companies ?? subgroup.companies?.length ?? 0;
  const employeeCount = subgroup._count?.employees ?? 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Color bar */}
      <div className="h-1.5" style={{ backgroundColor: subgroup.color || "#6366F1" }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Dot */}
          <div
            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: subgroup.color || "#6366F1" }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{subgroup.name}</span>
              {subgroup.code && (
                <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {subgroup.code}
                </span>
              )}
              {subgroup.group && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${subgroup.group.color || "#6366F1"}20`,
                    color: subgroup.group.color || "#6366F1",
                  }}
                >
                  {subgroup.group.name}
                </span>
              )}
            </div>

            {subgroup.description && (
              <p className="text-sm text-gray-500 mt-0.5">{subgroup.description}</p>
            )}

            {/* Stats */}
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              <button
                type="button"
                onClick={onViewEmployees}
                className="flex items-center gap-1 hover:text-blue-600 hover:underline"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{entityCount} entities</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={onAssign}
              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200"
            >
              Assign Entities
            </button>
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={entityCount > 0}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title={entityCount > 0 ? "Remove all entities first" : "Delete subgroup"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded: entity list */}
        {expanded && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Entities ({entityCount})
            </p>
            {!subgroup.companies || subgroup.companies.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No entities assigned. Click "Assign Entities" to add.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {subgroup.companies.map(company => (
                  <div
                    key={company.id}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded-lg"
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      {company.code || "—"}
                    </span>
                    <span className="text-gray-700 truncate">{company.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
