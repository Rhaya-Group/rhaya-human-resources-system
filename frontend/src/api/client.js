import axios from "axios";

// Base URL - uses proxy in dev, full URL in production
// const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_URL = import.meta.env.VITE_API_URL || "/api";

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;

    // ========================================
    // CRITICAL: Do NOT redirect on auth endpoints
    // ========================================
    const authEndpoints = [
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-reset-token",
    ];

    const isAuthEndpoint = authEndpoints.some((endpoint) =>
      config?.url?.includes(endpoint),
    );

    // If it's an auth endpoint, let the component handle the error
    if (isAuthEndpoint) {
      return Promise.reject({
        message:
          response?.data?.error ||
          response?.data?.message ||
          error.message ||
          "An error occurred",
        status: response?.status,
        data: response?.data,
      });
    }

    // ========================================
    // Handle 401 on protected routes (token expired/invalid)
    // ========================================
    if (response?.status === 401) {
      // Clear stored auth data
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Redirect to login
      window.location.href = "/login";
    }

    // ========================================
    // Return formatted error for other cases
    // ========================================
    return Promise.reject({
      message:
        response?.data?.message ||
        response?.data?.error ||
        error.message ||
        "An error occurred",
      status: response?.status,
      data: response?.data,
    });
  },
);

export default apiClient;

// ============================================
// OVERTIME FUNCTIONS
// ============================================

export const submitOvertimeRequest = async (data) => {
  const response = await apiClient.post("/overtime/submit", data);
  return response.data.data;
};

/**
 * Get my overtime requests
 */
export const getMyOvertimeRequests = async (params = {}) => {
  const response = await apiClient.get("/overtime/my-requests", { params });
  return response.data.data;
};

/**
 * Get my overtime balance
 */
export const getMyOvertimeBalance = async () => {
  const response = await apiClient.get("/overtime/my-balance");
  return response.data.data;
};

/**
 * Get single overtime request by ID
 */
export const getOvertimeRequestById = async (requestId) => {
  const response = await apiClient.get(`/overtime/${requestId}`);
  return response.data.data;
};

/**
 * Edit overtime request
 */
export const editOvertimeRequest = async (requestId, data) => {
  const response = await apiClient.put(`/overtime/${requestId}`, data);
  return response.data.data;
};

/**
 * Actualize overtime request (submit actual hours after overtime date passes)
 * entries: [{ entryId, actualHours }]
 */
export const actualizeOvertimeRequest = async (requestId, entries) => {
  const response = await apiClient.post(`/overtime/${requestId}/actualize`, { entries });
  return response.data;
};

/**
 * Delete overtime request
 */
export const deleteOvertimeRequest = async (requestId) => {
  const response = await apiClient.delete(`/overtime/${requestId}`);
  return response.data;
};

/**
 * Get pending approvals (for approvers)
 */
export const getPendingOvertimeApprovals = async () => {
  const response = await apiClient.get("/overtime/pending-approval/list");
  return response.data.data;
};

/**
 * Approve overtime request
 */
export const approveOvertimeRequest = async (requestId, comment) => {
  const response = await apiClient.post(`/overtime/${requestId}/approve`, {
    comment,
  });
  return response.data.data;
};

/**
 * Reject overtime request
 */
export const rejectOvertimeRequest = async (requestId, comment) => {
  const response = await apiClient.post(`/overtime/${requestId}/reject`, {
    comment,
  });
  return response.data.data;
};

/**
 * Request revision
 */
export const requestOvertimeRevision = async (requestId, comment) => {
  const response = await apiClient.post(
    `/overtime/${requestId}/request-revision`,
    { comment },
  );
  return response.data.data;
};

// ============================================
// ADMIN OVERTIME FUNCTIONS
// ============================================

/**
 * Get all overtime requests (Admin)
 */
export const getAllOvertimeRequests = async (params = {}) => {
  const response = await apiClient.get("/overtime/admin/all-requests", {
    params,
  });
  return response.data.data;
};

/**
 * Process monthly balance (Admin)
 */
export const processMonthlyOvertimeBalance = async (data) => {
  const response = await apiClient.post(
    "/overtime/admin/process-balance",
    data,
  );
  return response.data;
};

/**
 * Reset employee overtime balance (Admin)
 */
export const resetOvertimeBalance = async (userId) => {
  const response = await apiClient.post(
    `/overtime/admin/reset-balance/${userId}`,
  );
  return response.data;
};

/**
 * Get overtime statistics (Admin)
 */
export const getOvertimeStatistics = async (params = {}) => {
  const response = await apiClient.get("/overtime/admin/statistics", {
    params,
  });
  return response.data.data;
};

// ============================================
// LEAVE FUNCTIONS
// ============================================

/**
 * Submit leave request
 */
export const submitLeaveRequest = async (data) => {
  const response = await apiClient.post("/leave/submit", data);
  return response.data.data;
};

/**
 * Get my leave requests
 */
export const getMyLeaveRequests = async (params = {}) => {
  const response = await apiClient.get("/leave/my-requests", { params });
  return response.data.data;
};

/**
 * Get my leave balance
 */
export const getMyLeaveBalance = async () => {
  const currentYear = new Date().getFullYear();
  const response = await apiClient.get(`/leave/balance/${currentYear}`);
  return response.data.data;
};

/**
 * Get leave balance by year
 */
export const getLeaveBalanceByYear = async (year) => {
  const response = await apiClient.get(`/leave/balance/${year}`);
  return response.data.data;
};

/**
 * Get pending leave approvals (for approvers)
 */
export const getPendingLeaveApprovals = async () => {
  const response = await apiClient.get("/leave/pending-approval/list");
  return response.data.data;
};

/**
 * Approve leave request
 */
export const approveLeaveRequest = async (requestId, comment) => {
  const response = await apiClient.post(`/leave/${requestId}/approve`, {
    comment,
  });
  return response.data.data;
};

/**
 * Reject leave request
 */
export const rejectLeaveRequest = async (requestId, comment) => {
  const response = await apiClient.post(`/leave/${requestId}/reject`, {
    comment,
  });
  return response.data.data;
};

/**
 * Get leave request details
 */
export const getLeaveRequestDetails = async (requestId) => {
  const response = await apiClient.get(`/leave/${requestId}`);
  return response.data.data;
};

/**
 * Delete leave request (only if pending)
 */
export const deleteLeaveRequest = async (requestId) => {
  const response = await apiClient.delete(`/leave/${requestId}`);
  return response.data;
};

// ============================================
// ADMIN LEAVE FUNCTIONS
// ============================================

/**
 * Get all leave requests (Admin)
 */
export const getAllLeaveRequests = async (params = {}) => {
  const response = await apiClient.get("/leave/admin/all-requests", { params });
  return response.data.data;
};

// ============================================
// WORK STATUS FUNCTIONS
// ============================================

/**
 * Get work statuses (today or date range)
 * params: { date?, startDate?, endDate? }
 */
export const getWorkStatuses = async (params = {}) => {
  const response = await apiClient.get("/work-status", { params });
  return response.data;
};

/**
 * Set work status for an employee on a date
 * body: { employeeId, date, status, note? }
 */
export const setWorkStatus = async (body) => {
  const response = await apiClient.post("/work-status", body);
  return response.data;
};

/**
 * Delete a work status record (resets to WFO default)
 */
export const deleteWorkStatus = async (id) => {
  const response = await apiClient.delete(`/work-status/${id}`);
  return response.data;
};

/**
 * Get attendance view permissions
 */
export const getAttendancePermissions = async () => {
  const response = await apiClient.get("/work-status/permissions");
  return response.data;
};

/**
 * Grant attendance view permission (L1 admin)
 * body: { userId, scopeType, scopeId }
 */
export const grantAttendancePermission = async (body) => {
  const response = await apiClient.post("/work-status/permissions", body);
  return response.data;
};

/**
 * Revoke attendance view permission (L1 admin)
 */
export const revokeAttendancePermission = async (id) => {
  const response = await apiClient.delete(`/work-status/permissions/${id}`);
  return response.data;
};

/**
 * Search users for permission assignment (L1 admin)
 */
export const searchUsersForPermission = async (q) => {
  const response = await apiClient.get("/work-status/permissions/users", { params: { q } });
  return response.data;
};

/**
 * Get work status default for an employee (own or admin querying another)
 */
export const getWorkStatusDefault = async (employeeId) => {
  const params = employeeId ? { employeeId } : {};
  const response = await apiClient.get("/work-status/defaults", { params });
  return response.data;
};

/**
 * Set work status default
 * body: { status, note?, employeeId? }
 */
export const setWorkStatusDefault = async (body) => {
  const response = await apiClient.post("/work-status/defaults", body);
  return response.data;
};

/**
 * Delete (reset) work status default
 */
export const deleteWorkStatusDefault = async (employeeId) => {
  const response = await apiClient.delete(`/work-status/defaults/${employeeId}`);
  return response.data;
};

/**
 * Get personal calendar statuses (own data for a date range)
 * params: { startDate, endDate }
 */
export const getMyCalendarStatuses = async (params) => {
  const response = await apiClient.get("/work-status", { params: { ...params, myCalendar: "true" } });
  return response.data;
};

/**
 * Get Indonesian public holidays for a given year
 * Returns [{ date: "YYYY-MM-DD", name, localName }]
 */
export const getHolidays = async (year) => {
  const response = await apiClient.get("/work-status/holidays", { params: { year } });
  return response.data;
};

// ============================================
// WFH SCHEDULING FUNCTIONS
// ============================================

export const getWfhScopes = async () => {
  const response = await apiClient.get("/wfh/scope");
  return response.data;
};

export const addWfhScope = async (body) => {
  const response = await apiClient.post("/wfh/scope", body);
  return response.data;
};

export const updateWfhScope = async (id, body) => {
  const response = await apiClient.patch(`/wfh/scope/${id}`, body);
  return response.data;
};

export const deleteWfhScope = async (id) => {
  const response = await apiClient.delete(`/wfh/scope/${id}`);
  return response.data;
};

export const getWfhQuotas = async () => {
  const response = await apiClient.get("/wfh/quota");
  return response.data;
};

export const setWfhQuota = async (body) => {
  const response = await apiClient.post("/wfh/quota", body);
  return response.data;
};

export const deleteWfhQuota = async (employeeId) => {
  const response = await apiClient.delete(`/wfh/quota/${employeeId}`);
  return response.data;
};

export const getWfhSchedule = async (weekStartDate) => {
  const params = weekStartDate ? { weekStartDate } : {};
  const response = await apiClient.get("/wfh/schedule", { params });
  return response.data;
};

export const submitWfhSchedule = async (body) => {
  const response = await apiClient.post("/wfh/schedule", body);
  return response.data;
};

export const deleteWfhSchedule = async (id) => {
  const response = await apiClient.delete(`/wfh/schedule/${id}`);
  return response.data;
};

export const getWfhEligibleEmployees = async () => {
  const response = await apiClient.get("/wfh/admin/employees");
  return response.data;
};

export const checkWfhScope = async () => {
  const response = await apiClient.get("/wfh/check-scope");
  return response.data;
};

export const getWfhWindowOverride = async () => {
  const response = await apiClient.get("/wfh/admin/window-override");
  return response.data;
};

export const setWfhWindowOverride = async (body) => {
  const response = await apiClient.post("/wfh/admin/window-override", body);
  return response.data;
};

export const addWfhExclusion = async (employeeId, reason) => {
  const response = await apiClient.post("/wfh/admin/excluded", { employeeId, reason });
  return response.data;
};

export const removeWfhExclusion = async (employeeId) => {
  const response = await apiClient.delete(`/wfh/admin/excluded/${employeeId}`);
  return response.data;
};
