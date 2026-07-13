// frontend/src/pages/UserDetail.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import Select from "react-select";
import FilesTab from "../components/FilesTab";
import PayslipsTab from "../components/PayslipsTab";
import OvertimeRecapTab from "../components/OvertimeRecapTab";
import LeaveHistoryTab from "../components/LeaveHistoryTab";
import OffboardingTab from "../components/OffboardingTab";
import EmergencyContacts from "../components/EmergencyContacts";

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Check if opened in edit or balance mode via query param
  const searchParams = new URLSearchParams(window.location.search);
  const queryMode = searchParams.get("mode");
  const initialMode = ["edit", "balance"].includes(queryMode)
    ? queryMode
    : "view";

  const [user, setUser] = useState(null);
  const [dataLoading, setDataLoading] = useState(false); // separate loading state
  const [mode, setMode] = useState(initialMode); // 'view' | 'edit' | 'balance'
  // const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'balance'
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'contracts' | 'overtime' | 'leave' | 'activity'

  // Dropdown data
  const [roles, setRoles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [plottingCompanies, setPlottingCompanies] = useState([]);
  const [potentialSupervisors, setPotentialSupervisors] = useState([]);

  // Inline create states
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [isCreatingDivision, setIsCreatingDivision] = useState(false);
  const [isCreatingPlottingCompany, setIsCreatingPlottingCompany] =
    useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newPlottingCompanyCode, setNewPlottingCompanyCode] = useState("");
  const [newPlottingCompanyName, setNewPlottingCompanyName] = useState("");

  const [availableEntities, setAvailableEntities] = useState([]);
  const [scopeEntityIds, setScopeEntityIds] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [selectedPlottingCompany, setSelectedPlottingCompany] = useState(null);

  const [formData, setFormData] = useState({});
  const [balanceData, setBalanceData] = useState({
    overtimeHours: "",
    overtimeAction: "add",
    overtimeReason: "",
    leaveYear: new Date().getFullYear(),
    annualQuota: "",
    leaveReason: "",
    toilDays: "",
    toilAction: "add",
    toilReason: "",
  });

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState("soft");
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve
    if (!currentUser || currentUser.accessLevel > 2) {
      navigate("/");
      return;
    }
    fetchAll();
  }, [userId, authLoading, currentUser]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    navigate("/login");
    return null;
  }

  const isAdmin = currentUser.accessLevel <= 2;

  const fetchAll = async () => {
    setDataLoading(true);
    try {
      const [userRes, rolesRes, divisionsRes, companiesRes, usersRes] =
        await Promise.all([
          apiClient.get(`/users/${userId}`),
          apiClient.get("/roles"),
          apiClient.get("/divisions"),
          apiClient.get("/plotting-companies"),
          apiClient.get("/users"),
        ]);

      const u = userRes.data.data;
      setUser(u);
      setRoles(rolesRes.data.data || []);
      setDivisions(divisionsRes.data.data || []);
      setPlottingCompanies(companiesRes.data.data || []);
      setAvailableEntities(companiesRes.data.data || []);

      const allUsers = usersRes.data.data || [];
      setPotentialSupervisors(
        allUsers.filter(
          (s) => s.id !== u.id && ["PKWTT", "PKWT"].includes(s.employeeStatus),
        ),
      );

      populateForm(u);
    } catch (error) {
      console.error("fetchAll error:", error);
      alert(
        "Failed to load user: " +
          (error.response?.data?.error || error.message),
      );
      navigate("/users/manage");
    } finally {
      setDataLoading(false);
    }
  };

  const populateForm = (u) => {
    setFormData({
      username: u.username || "",
      email: u.email || "",
      password: "",
      name: u.name || "",
      nip: u.nip || "",
      nik: u.nik || "",
      npwp: u.npwp || "",
      phone: u.phone || "",
      dateOfBirth: u.dateOfBirth
        ? new Date(u.dateOfBirth).toISOString().split("T")[0]
        : "",
      placeOfBirth: u.placeOfBirth || "",
      address: u.address || "",
      gender: u.gender || "Not Specified",
      roleId: u.roleId || "",
      divisionId: u.divisionId || "",
      supervisorId: u.supervisorId || "",
      accessLevel: u.accessLevel?.toString() || "4",
      employeeStatus: u.employeeStatus || "PKWT",
      joinDate: u.joinDate
        ? new Date(u.joinDate).toISOString().split("T")[0]
        : "",
      plottingCompanyId: u.plottingCompanyId || "",
      contractStartDate: u.contractStartDate
        ? new Date(u.contractStartDate).toISOString().split("T")[0]
        : "",
      contractEndDate: u.contractEndDate
        ? new Date(u.contractEndDate).toISOString().split("T")[0]
        : "",
      bpjsHealth: u.bpjsHealth || "",
      bpjsEmployment: u.bpjsEmployment || "",
      overtimeRate: u.overtimeRate?.toString() || "300000",
    });

    setSelectedSupervisor(
      u.supervisor
        ? {
            value: u.supervisor.id,
            label: `${u.supervisor.name}${u.supervisor.nip ? ` (${u.supervisor.nip})` : ""} - ${u.supervisor.role?.name || "N/A"}`,
          }
        : null,
    );

    setSelectedPlottingCompany(
      u.plottingCompany
        ? {
            value: u.plottingCompany.id,
            label: `${u.plottingCompany.code} - ${u.plottingCompany.name}`,
          }
        : null,
    );
    setScopeEntityIds(u.scopeEntityIds || []);
  };

  // ── Utilities ──────────────────────────────────────────────
  const getAccessLevelLabel = (level) =>
    ({
      1: "Administrator",
      2: "Subsidiary HR",
      3: "Head",
      4: "Staff",
      5: "Intern",
    })[level] || "Unknown";

  const canEditUser = (currentUser, targetUser) => {
    if (currentUser.accessLevel === 1) return true;
    if (currentUser.accessLevel === 2) return targetUser.accessLevel >= 3;
    return false;
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(v);

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "N/A";

  const getStatusBadgeColor = (status) =>
    ({
      PKWTT: "bg-green-100 text-green-800",
      PKWT: "bg-blue-100 text-blue-800",
      INTERNSHIP: "bg-purple-100 text-purple-800",
      FREELANCE: "bg-yellow-100 text-yellow-800",
      PROBATION: "bg-orange-100 text-orange-800",
      INACTIVE: "bg-gray-100 text-gray-800",
      ADMIN: "bg-red-100 text-red-800",
    })[status] || "bg-gray-100 text-gray-800";

  const selectStyles = {
    control: (base) => ({ ...base, minHeight: "42px", borderColor: "#d1d5db" }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
  };

  const supervisorOptions = potentialSupervisors
    .sort(
      (a, b) => a.accessLevel - b.accessLevel || a.name.localeCompare(b.name),
    )
    .map((s) => ({
      value: s.id,
      label: `${s.name}${s.nip ? ` (${s.nip})` : ""} - ${s.role?.name || "N/A"}`,
    }));

  const plottingCompanyOptions = plottingCompanies
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));

  // ── Inline create handlers ─────────────────────────────────
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return alert("Please enter a role name");
    try {
      const res = await apiClient.post("/roles/create", {
        name: newRoleName.trim(),
      });
      const newRole = res.data.data;
      setRoles((prev) =>
        [...prev, newRole].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormData((f) => ({ ...f, roleId: newRole.id }));
      setNewRoleName("");
      setIsCreatingRole(false);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to create role");
    }
  };

  const handleCreateDivision = async () => {
    if (!newDivisionName.trim()) return alert("Please enter a division name");
    try {
      const res = await apiClient.post("/divisions/create", {
        name: newDivisionName.trim(),
      });
      const newDiv = res.data.data;
      setDivisions((prev) =>
        [...prev, newDiv].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormData((f) => ({ ...f, divisionId: newDiv.id }));
      setNewDivisionName("");
      setIsCreatingDivision(false);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to create division");
    }
  };

  const handleCreatePlottingCompany = async () => {
    if (!newPlottingCompanyCode.trim() || !newPlottingCompanyName.trim())
      return alert("Please enter both code and name");
    try {
      const res = await apiClient.post("/plotting-companies/create", {
        code: newPlottingCompanyCode.trim().toUpperCase(),
        name: newPlottingCompanyName.trim(),
      });
      const newC = res.data.data;
      setPlottingCompanies((prev) =>
        [...prev, newC].sort((a, b) => a.code.localeCompare(b.code)),
      );
      setSelectedPlottingCompany({
        value: newC.id,
        label: `${newC.code} - ${newC.name}`,
      });
      setFormData((f) => ({ ...f, plottingCompanyId: newC.id }));
      setNewPlottingCompanyCode("");
      setNewPlottingCompanyName("");
      setIsCreatingPlottingCompany(false);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to create plotting company");
    }
  };

  // ── Submit edit ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.nik && formData.nik.length !== 16)
      return alert("NIK must be exactly 16 digits");
    if (formData.npwp && formData.npwp.replace(/\D/g, "").length !== 15)
      return alert("NPWP must be exactly 15 digits");

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        accessLevel: parseInt(formData.accessLevel),
        overtimeRate: parseFloat(formData.overtimeRate || 0),
        scopeEntityIds: scopeEntityIds,
        dateOfBirth: formData.dateOfBirth || null,
        joinDate: formData.joinDate || null,
        contractStartDate: formData.contractStartDate || null,
        contractEndDate: formData.contractEndDate || null,
        gender: formData.gender || "Not Specified",
        plottingCompanyId: formData.plottingCompanyId || null,
        nik: formData.nik || null,
        npwp: formData.npwp || null,
      };
      if (!payload.password) delete payload.password;

      await apiClient.put(`/users/${userId}`, payload);
      alert("User updated successfully!");
      setMode("view");
      fetchAll();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit balance ─────────────────────────────────────────
  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    const adjustments = {};

    if (balanceData.overtimeHours) {
      if (!balanceData.overtimeReason.trim())
        return alert("Please provide a reason for overtime adjustment");
      const hours = parseFloat(balanceData.overtimeHours);
      if (isNaN(hours) || hours <= 0)
        return alert("Please enter a valid number of hours");
      adjustments.overtime = {
        amount: balanceData.overtimeAction === "add" ? hours : -hours,
        reason: balanceData.overtimeReason,
      };
    }

    if (balanceData.annualQuota) {
      if (!balanceData.leaveReason.trim())
        return alert("Please provide a reason for leave adjustment");
      const quota = parseInt(balanceData.annualQuota);
      if (isNaN(quota) || quota < 0)
        return alert("Please enter a valid annual quota");
      adjustments.leave = {
        year: balanceData.leaveYear,
        annualQuota: quota,
        reason: balanceData.leaveReason,
      };
    }

    if (balanceData.toilDays) {
      if (!balanceData.toilReason.trim())
        return alert("Please provide a reason for TOIL adjustment");
      const days = parseInt(balanceData.toilDays);
      if (isNaN(days) || days <= 0)
        return alert("Please enter a valid number of days");
      adjustments.toil = {
        amount: balanceData.toilAction === "add" ? days : -days,
        reason: balanceData.toilReason,
      };
    }

    if (Object.keys(adjustments).length === 0)
      return alert("Please fill in at least one adjustment");

    try {
      await apiClient.post(`/users/${userId}/adjust-balance`, adjustments);
      alert("Balance adjusted successfully!");
      setBalanceData({
        overtimeHours: "",
        overtimeAction: "add",
        overtimeReason: "",
        leaveYear: new Date().getFullYear(),
        annualQuota: "",
        leaveReason: "",
        toilDays: "",
        toilAction: "add",
        toilReason: "",
      });
      setMode("view");
      fetchAll();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to adjust balance");
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      if (deleteMode === "soft") {
        await apiClient.put(`/users/${userId}/deactivate`);
        alert(`User ${user.name} has been deactivated`);
        navigate("/users/manage");
      } else {
        if (deleteConfirmUsername !== user.username)
          return alert("Username confirmation does not match!");
        if (
          !confirm(
            `⚠️ FINAL WARNING!\n\nPermanently delete ${user.name} and ALL their data?\n\nThis CANNOT be undone!`,
          )
        )
          return;
        await apiClient.delete(`/users/${userId}/permanent`, {
          data: { confirmUsername: deleteConfirmUsername },
        });
        alert(`User ${user.name} has been permanently deleted`);
        navigate("/users/manage");
      }
    } catch (e) {
      alert(e.response?.data?.error || "Failed to delete user");
    }
  };

  // ── Render ─────────────────────────────────────────────────
  if (authLoading || dataLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/users/manage")}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-sm text-gray-500">
              @{user.nip} · {user.email}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {mode === "view" && (
          <div className="flex space-x-2">
            <button
              onClick={() => setMode("balance")}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center text-sm"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Adjust Balance
            </button>
            <button
              onClick={() => setMode("edit")}
              disabled={!canEditUser(currentUser, user)}
              className={`px-4 py-2 rounded-lg ${
                canEditUser(currentUser, user)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit User
            </button>
            <button
              onClick={() => {
                setDeleteMode(
                  user.employeeStatus === "INACTIVE" ? "hard" : "soft",
                );
                setDeleteConfirmUsername("");
                setShowDeleteModal(true);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        )}

        {(mode === "edit" || mode === "balance") && (
          <button
            onClick={() => setMode("view")}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            ← Back to View
          </button>
        )}
      </div>

      {/* ── TAB NAVIGATION ───────────────────────────────────── */}
      {mode === "view" && (
        <div className="mb-6 bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: "overview", label: "Overview" },
                { id: "files", label: "Files" },
                { id: "payslips", label: "Payslips" },
                { id: "overtime", label: "Overtime Recap", badge: 0 },
                { id: "leave", label: "Leave History", badge: 0 },
                { id: "offboarding", label: "Offboarding" },
                { id: "activity", label: "Activity Log" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 flex items-center relative ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-600">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ── VIEW MODE ───────────────────────────────────────── */}
      {mode === "view" && activeTab === "overview" && (
        <div className="space-y-6">
          {/* Avatar card */}
          <div className="bg-white rounded-lg shadow p-6 flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500">
                {user.email} · @{user.username}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusBadgeColor(user.employeeStatus)}`}
                >
                  {user.employeeStatus}
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">
                  Level {user.accessLevel} -{" "}
                  {getAccessLevelLabel(user.accessLevel)}
                </span>
              </div>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-700">
                Overtime Balance
              </p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {user.overtimeBalance?.currentBalance != null
                  ? user.overtimeBalance.currentBalance.toFixed(1)
                  : "0.0"}{" "}
                hours
              </p>
              {user.overtimeBalance?.pendingHours > 0 && (
                <p className="text-xs text-purple-600 mt-1">
                  Pending: {user.overtimeBalance.pendingHours.toFixed(1)} hours
                </p>
              )}
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700">
                Leave Balance {new Date().getFullYear()}
              </p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {(user.leaveBalance?.annualRemaining || 0) +
                  (user.leaveBalance?.toilBalance || 0)}{" "}
                days
              </p>
              <p className="text-xs text-green-600 mt-1">
                Annual: {user.leaveBalance?.annualRemaining || 0} · TOIL:{" "}
                {user.leaveBalance?.toilBalance || 0}
              </p>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Gender", user.gender || "Not Specified"],
                ["NIP", user.nip || "N/A"],
                ["NIK", user.nik || "N/A"],
                ["NPWP", user.npwp || "N/A"],
                ["Phone", user.phone || "N/A"],
                ["Date of Birth", formatDate(user.dateOfBirth)],
                ["Place of Birth", user.placeOfBirth || "N/A"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="text-sm text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500">Address</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {user.address || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Contacts (read-only — employee manages their own) */}
          <EmergencyContacts userId={userId} canEdit={false} variant="plain" />

          {/* Employment Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">
              Employment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Role", user.role?.name || "N/A"],
                ["Division", user.division?.name || "N/A"],
                ["Supervisor", user.supervisor?.name || "None"],
                [
                  "Plotting Company",
                  user.plottingCompany
                    ? `${user.plottingCompany.code} - ${user.plottingCompany.name}`
                    : "N/A",
                ],
                ["Join Date", formatDate(user.joinDate)],
                ["Contract Start", formatDate(user.contractStartDate)],
                ["Contract End", formatDate(user.contractEndDate)],
                ["Overtime Rate", formatCurrency(user.overtimeRate || 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="text-sm text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* BPJS Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">
              BPJS Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["BPJS Health", user.bpjsHealth || "N/A"],
                ["BPJS Employment", user.bpjsEmployment || "N/A"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="text-sm text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {user.accessLevel === 2 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4 border-b pb-2">
                <svg
                  className="w-5 h-5 text-blue-600 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h3 className="font-semibold text-gray-900">
                  Entity Access Scope
                </h3>
              </div>

              {user.scopeEntityIds && user.scopeEntityIds.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Has access to <strong>{user.scopeEntityIds.length}</strong>{" "}
                    {user.scopeEntityIds.length === 1 ? "entity" : "entities"}:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {plottingCompanies
                      .filter((pc) => user.scopeEntityIds.includes(pc.id))
                      .map((entity) => (
                        <div
                          key={entity.id}
                          className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">
                              {entity.name}
                            </div>
                            <div className="text-xs text-gray-600">
                              Code: {entity.code}
                            </div>
                          </div>
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-yellow-600 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="text-sm text-yellow-800">
                      No entities assigned - cannot access any data
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Files TAB */}
      {mode === "view" && activeTab === "files" && (
        <FilesTab userId={userId} isAdmin={currentUser.accessLevel <= 2} />
      )}

      {/* Payslips Tab */}
      {mode === "view" && activeTab === "payslips" && (
        <PayslipsTab userId={userId} />
      )}

      {/* ── OVERTIME RECAP TAB ─────────────────────────────────── */}
      {mode === "view" && activeTab === "overtime" && (
        <OvertimeRecapTab userId={userId} isAdmin={isAdmin} />
      )}

      {/* ── LEAVE HISTORY TAB ──────────────────────────────────── */}
      {mode === "view" && activeTab === "leave" && (
        <LeaveHistoryTab userId={userId} />
      )}

      {mode === "view" && activeTab === "offboarding" && isAdmin && (
        <OffboardingTab userId={userId} />
      )}

      {/* ── ACTIVITY LOG TAB ───────────────────────────────────── */}
      {mode === "view" && activeTab === "activity" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Activity & Audit Log
            </h3>
            <p className="text-gray-500">User activity tracking coming soon</p>
          </div>
        </div>
      )}

      {/* ── EDIT MODE ───────────────────────────────────────── */}
      {mode === "edit" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-l-4 border-blue-500 pl-3">
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, username: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password{" "}
                  <span className="text-xs text-gray-500">
                    (leave blank to keep current)
                  </span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Leave blank to keep current password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Personal */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-l-4 border-green-500 pl-3">
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIP
                </label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, nip: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIK
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={formData.nik}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      nik: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  placeholder="16-digit national ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {formData.nik && formData.nik.length !== 16 && (
                  <p className="text-xs text-red-500 mt-1">
                    NIK must be exactly 16 digits
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NPWP
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={formData.npwp}
                  placeholder="XX.XXX.XXX.X-XXX.XXX"
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 15);
                    let fmt = d.slice(0, 2);
                    if (d.length > 2) fmt += "." + d.slice(2, 5);
                    if (d.length > 5) fmt += "." + d.slice(5, 8);
                    if (d.length > 8) fmt += "." + d.slice(8, 9);
                    if (d.length > 9) fmt += "-" + d.slice(9, 12);
                    if (d.length > 12) fmt += "." + d.slice(12, 15);
                    setFormData((f) => ({ ...f, npwp: fmt }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, dateOfBirth: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Place of Birth
                </label>
                <input
                  type="text"
                  value={formData.placeOfBirth}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, placeOfBirth: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, gender: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Not Specified">Not Specified</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, address: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-l-4 border-purple-500 pl-3">
              Employment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                {isCreatingRole ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Role name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCreateRole}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingRole(false);
                        setNewRoleName("");
                      }}
                      className="px-3 py-2 bg-gray-300 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <select
                      required
                      value={formData.roleId}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, roleId: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingRole(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Division */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Division <span className="text-red-500">*</span>
                </label>
                {isCreatingDivision ? (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newDivisionName}
                      onChange={(e) => setNewDivisionName(e.target.value)}
                      placeholder="Division name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCreateDivision}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingDivision(false);
                        setNewDivisionName("");
                      }}
                      className="px-3 py-2 bg-gray-300 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <select
                      required
                      value={formData.divisionId}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          divisionId: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Division</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingDivision(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Level <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.accessLevel}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, accessLevel: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {currentUser.accessLevel === 1 ? (
                    <>
                      <option value="1">Level 1 - System Administrator</option>
                      <option value="2">Level 2 - Subsidiary HR</option>
                      <option value="3">Level 3 - Manager</option>
                      <option value="4">Level 4 - Staff</option>
                      <option value="5">Level 5 - Intern</option>
                    </>
                  ) : (
                    <>
                      <option value="3">Level 3 - Manager</option>
                      <option value="4">Level 4 - Staff</option>
                      <option value="5">Level 5 - Intern</option>
                    </>
                  )}
                </select>
              </div>

              {/* ✅ ADD THIS: Scope Assignment for Level 2 */}
              {formData.accessLevel === "2" && (
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Entity Access Scope
                  </h4>

                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-700">
                      {scopeEntityIds.length} of {availableEntities.length}{" "}
                      selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setScopeEntityIds(availableEntities.map((e) => e.id))
                        }
                        className="text-xs text-blue-600"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setScopeEntityIds([])}
                        className="text-xs text-blue-600"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto bg-white border rounded-lg p-3 space-y-2">
                    {availableEntities.map((entity) => (
                      <label
                        key={entity.id}
                        className="flex items-center p-2 hover:bg-blue-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={scopeEntityIds.includes(entity.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScopeEntityIds([...scopeEntityIds, entity.id]);
                            } else {
                              setScopeEntityIds(
                                scopeEntityIds.filter((id) => id !== entity.id),
                              );
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="ml-3 text-sm">
                          {entity.code} - {entity.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.employeeStatus}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      employeeStatus: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="PKWTT">PKWTT (Permanent)</option>
                  <option value="PKWT">PKWT (Contract)</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="PROBATION">Probation</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {/* Plotting Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plotting Company
                </label>
                {isCreatingPlottingCompany ? (
                  <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">
                        New Plotting Company
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingPlottingCompany(false);
                          setNewPlottingCompanyCode("");
                          setNewPlottingCompanyName("");
                        }}
                        className="text-blue-600 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newPlottingCompanyCode}
                      onChange={(e) =>
                        setNewPlottingCompanyCode(e.target.value.toUpperCase())
                      }
                      placeholder="Code (e.g. RFI)"
                      maxLength={10}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newPlottingCompanyName}
                      onChange={(e) =>
                        setNewPlottingCompanyName(e.target.value)
                      }
                      placeholder="Company Name"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleCreatePlottingCompany}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Create
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        value={selectedPlottingCompany}
                        onChange={(opt) => {
                          setSelectedPlottingCompany(opt);
                          setFormData((f) => ({
                            ...f,
                            plottingCompanyId: opt?.value || "",
                          }));
                        }}
                        options={plottingCompanyOptions}
                        styles={selectStyles}
                        placeholder="Select plotting company..."
                        isClearable
                        isSearchable
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlottingCompany(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Supervisor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor
                </label>
                <Select
                  value={selectedSupervisor}
                  onChange={(opt) => {
                    setSelectedSupervisor(opt);
                    setFormData((f) => ({
                      ...f,
                      supervisorId: opt?.value || "",
                    }));
                  }}
                  options={supervisorOptions}
                  styles={selectStyles}
                  placeholder="Search supervisor..."
                  isClearable
                  isSearchable
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Join Date
                </label>
                <input
                  type="date"
                  value={formData.joinDate}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, joinDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Start Date
                </label>
                <input
                  type="date"
                  value={formData.contractStartDate}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      contractStartDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract End Date
                </label>
                <input
                  type="date"
                  value={formData.contractEndDate}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      contractEndDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overtime Rate (IDR/hour)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.overtimeRate}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, overtimeRate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* BPJS */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4 border-l-4 border-orange-500 pl-3">
              BPJS Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BPJS Health Number
                </label>
                <input
                  type="text"
                  value={formData.bpjsHealth}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, bpjsHealth: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BPJS Employment Number
                </label>
                <input
                  type="text"
                  value={formData.bpjsEmployment}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      bpjsEmployment: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setMode("view")}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Updating...
                </>
              ) : (
                "Update User"
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── BALANCE MODE ────────────────────────────────────── */}
      {mode === "balance" && (
        <form onSubmit={handleAdjustBalance} className="space-y-6">
          {/* Current balances */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Current Balances — {user.name}
            </h3>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <p className="text-xs text-gray-600">Overtime</p>
                <p className="text-lg font-bold text-gray-900">
                  {user.overtimeBalance?.currentBalance?.toFixed(1) || "0.0"}{" "}
                  hours
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">
                  Annual Leave {new Date().getFullYear()}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {user.leaveBalance?.annualQuota || 0} days{" "}
                  <span className="text-sm text-gray-500">
                    ({user.leaveBalance?.annualRemaining || 0} days remaining)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">TOIL</p>
                <p className="text-lg font-bold text-gray-900">
                  {user.leaveBalance?.toilBalance || 0} days
                </p>
              </div>
            </div>
          </div>

          {/* Overtime adjustment */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <h3 className="font-semibold text-gray-900 mb-4">
              Overtime Balance Adjustment
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={balanceData.overtimeAction}
                  onChange={(e) =>
                    setBalanceData((b) => ({
                      ...b,
                      overtimeAction: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="add">Add Hours</option>
                  <option value="subtract">Subtract Hours</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hours
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={balanceData.overtimeHours}
                  onChange={(e) =>
                    setBalanceData((b) => ({
                      ...b,
                      overtimeHours: e.target.value,
                    }))
                  }
                  placeholder="e.g. 8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason{" "}
                {balanceData.overtimeHours && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                rows={2}
                value={balanceData.overtimeReason}
                onChange={(e) =>
                  setBalanceData((b) => ({
                    ...b,
                    overtimeReason: e.target.value,
                  }))
                }
                placeholder="Why are you adjusting this balance?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Leave adjustment */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <h3 className="font-semibold text-gray-900 mb-4">
              Leave Balance Adjustment
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={balanceData.leaveYear}
                  onChange={(e) =>
                    setBalanceData((b) => ({
                      ...b,
                      leaveYear: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {[-1, 0, 1].map((offset) => {
                    const y = new Date().getFullYear() + offset;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Quota (days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={balanceData.annualQuota}
                  onChange={(e) =>
                    setBalanceData((b) => ({
                      ...b,
                      annualQuota: e.target.value,
                    }))
                  }
                  placeholder="e.g. 14"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason{" "}
                {balanceData.annualQuota && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                rows={2}
                value={balanceData.leaveReason}
                onChange={(e) =>
                  setBalanceData((b) => ({ ...b, leaveReason: e.target.value }))
                }
                placeholder="Why are you adjusting this quota?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* TOIL adjustment */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="font-semibold text-gray-900 mb-4">
              TOIL Balance Adjustment
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={balanceData.toilAction}
                  onChange={(e) =>
                    setBalanceData((b) => ({
                      ...b,
                      toilAction: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="add">Add Days</option>
                  <option value="subtract">Subtract Days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={balanceData.toilDays}
                  onChange={(e) =>
                    setBalanceData((b) => ({ ...b, toilDays: e.target.value }))
                  }
                  placeholder="e.g. 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason{" "}
                {balanceData.toilDays && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                rows={2}
                value={balanceData.toilReason}
                onChange={(e) =>
                  setBalanceData((b) => ({ ...b, toilReason: e.target.value }))
                }
                placeholder="Why are you adjusting TOIL balance?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Adjust Balance
            </button>
          </div>
        </form>
      )}

      {/* ── DELETE MODAL ─────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Delete User: {user.name}
            </h2>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Username: <span className="font-medium">{user.username}</span>
              </p>
              <p className="text-sm text-gray-600">
                Email: <span className="font-medium">{user.email}</span>
              </p>
            </div>

            {user.employeeStatus === "INACTIVE" && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ User is already inactive. Only permanent deletion is
                  available.
                </p>
              </div>
            )}

            <div className="mb-4 space-y-3">
              <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="deleteMode"
                  value="soft"
                  checked={deleteMode === "soft"}
                  onChange={(e) => setDeleteMode(e.target.value)}
                  disabled={user.employeeStatus === "INACTIVE"}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    Deactivate (Recommended)
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Set status to Inactive. Data is preserved and can be
                    reactivated.
                  </p>
                </div>
              </label>
              <label className="flex items-start p-3 border-2 border-red-300 rounded-lg cursor-pointer hover:bg-red-50">
                <input
                  type="radio"
                  name="deleteMode"
                  value="hard"
                  checked={deleteMode === "hard"}
                  onChange={(e) => setDeleteMode(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-medium text-red-900">Permanent Delete</p>
                  <p className="text-sm text-red-700 mt-0.5">
                    ⚠️ Removes user and ALL data. Cannot be undone.
                  </p>
                </div>
              </label>
            </div>

            {deleteMode === "hard" && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-sm font-bold text-red-900 mb-2">
                  Type username to confirm:
                </p>
                <p className="font-mono font-bold text-sm bg-white px-2 py-1 rounded border border-red-300 mb-3">
                  {user.username}
                </p>
                <input
                  type="text"
                  value={deleteConfirmUsername}
                  onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                  placeholder={`Type "${user.username}" to confirm`}
                  className="w-full px-3 py-2 border-2 border-red-300 rounded-lg"
                  autoComplete="off"
                />
                {deleteConfirmUsername &&
                  deleteConfirmUsername !== user.username && (
                    <p className="text-xs text-red-600 mt-1">
                      ❌ Username does not match
                    </p>
                  )}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmUsername("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={
                  deleteMode === "hard" &&
                  deleteConfirmUsername !== user.username
                }
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${deleteMode === "soft" ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"}`}
              >
                {deleteMode === "soft"
                  ? "Deactivate User"
                  : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
