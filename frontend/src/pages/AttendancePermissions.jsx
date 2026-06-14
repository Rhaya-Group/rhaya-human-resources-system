// frontend/src/pages/AttendancePermissions.jsx
// L1 admin page to manage AttendanceViewPermission grants

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getAttendancePermissions,
  grantAttendancePermission,
  revokeAttendancePermission,
  searchUsersForPermission,
} from "../api/client";
import apiClient from "../api/client";
import { Plus, Trash2, Search, Shield, Building2, Users } from "lucide-react";

const SCOPE_LABELS = {
  ENTITY: { label: "Entity", icon: Building2, color: "bg-blue-100 text-blue-700" },
  SUBGROUP: { label: "Subgroup", icon: Users, color: "bg-indigo-100 text-indigo-700" },
  GROUP: { label: "Group", icon: Shield, color: "bg-purple-100 text-purple-700" },
};

export default function AttendancePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Grant form state
  const [showForm, setShowForm] = useState(false);
  const [formUser, setFormUser] = useState(null);
  const [formScopeType, setFormScopeType] = useState("ENTITY");
  const [formScopeId, setFormScopeId] = useState("");
  const [formScopeName, setFormScopeName] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [scopeOptions, setScopeOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.accessLevel === 1;

  const fetchPermissions = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await getAttendancePermissions();
      setPermissions(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Load scope options when scopeType changes
  useEffect(() => {
    const load = async () => {
      try {
        let endpoint = "";
        if (formScopeType === "ENTITY") endpoint = "/plotting-companies";
        else if (formScopeType === "SUBGROUP") endpoint = "/entity-subgroups";
        else if (formScopeType === "GROUP") endpoint = "/entity-groups";

        const res = await apiClient.get(endpoint);
        const items = res.data?.data || res.data || [];
        setScopeOptions(Array.isArray(items) ? items : []);
      } catch {
        setScopeOptions([]);
      }
    };
    load();
    setFormScopeId("");
    setFormScopeName("");
  }, [formScopeType]);

  // User search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!userSearch.trim()) { setUserResults([]); return; }
      try {
        const data = await searchUsersForPermission(userSearch);
        setUserResults(data.data || []);
      } catch {
        setUserResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!formUser || !formScopeId) return;
    setSubmitting(true);
    try {
      await grantAttendancePermission({
        userId: formUser.id,
        scopeType: formScopeType,
        scopeId: formScopeId,
      });
      setShowForm(false);
      setFormUser(null);
      setUserSearch("");
      setFormScopeId("");
      setFormScopeName("");
      await fetchPermissions();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to grant permission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id, userName) => {
    if (!window.confirm(`Revoke attendance view permission for ${userName}?`)) return;
    try {
      await revokeAttendancePermission(id);
      setPermissions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to revoke");
    }
  };

  // Guard after all hooks
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p>This page is restricted to super admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance View Permissions</h1>
            <p className="text-sm text-gray-500 mt-1">
              Grant specific accounts read access to work status schedules for an entity, subgroup, or group.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Grant Access
          </button>
        </div>

        {/* Grant form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Grant Attendance View Access</h2>
            <form onSubmit={handleGrant} className="space-y-4">
              {/* User search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account to grant access
                </label>
                {formUser ? (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900">{formUser.name}</div>
                      <div className="text-xs text-blue-600">{formUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setFormUser(null); setUserSearch(""); }}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {userResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                        {userResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setFormUser(u); setUserSearch(""); setUserResults([]); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                              {u.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{u.name}</div>
                              <div className="text-xs text-gray-500">{u.email} · L{u.accessLevel}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scope type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scope type</label>
                <div className="flex gap-2">
                  {Object.entries(SCOPE_LABELS).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormScopeType(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          formScopeType === key
                            ? "bg-blue-600 text-white border-blue-600"
                            : "text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <Icon size={14} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select {SCOPE_LABELS[formScopeType]?.label}
                </label>
                <select
                  value={formScopeId}
                  onChange={(e) => {
                    setFormScopeId(e.target.value);
                    const opt = scopeOptions.find((o) => o.id === e.target.value);
                    setFormScopeName(opt?.name || "");
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">-- Select --</option>
                  {scopeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !formUser || !formScopeId}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Granting..." : "Grant Access"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormUser(null); setUserSearch(""); }}
                  className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Permissions table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Active Grants ({permissions.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
          ) : permissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p>No permissions granted yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {permissions.map((perm) => {
                const scopeCfg = SCOPE_LABELS[perm.scopeType] || SCOPE_LABELS.ENTITY;
                const ScopeIcon = scopeCfg.icon;
                return (
                  <div
                    key={perm.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    {/* User */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                      {perm.user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{perm.user?.name}</div>
                      <div className="text-xs text-gray-500">{perm.user?.email}</div>
                    </div>

                    {/* Scope */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${scopeCfg.color}`}>
                      <ScopeIcon size={10} />
                      {scopeCfg.label}
                    </span>
                    <span className="text-sm text-gray-600 truncate max-w-[150px]">
                      {perm.scopeId}
                    </span>

                    {/* Granted by */}
                    <div className="text-xs text-gray-400 hidden sm:block">
                      by {perm.granter?.name}
                    </div>

                    {/* Revoke */}
                    <button
                      onClick={() => handleRevoke(perm.id, perm.user?.name)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Revoke"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
