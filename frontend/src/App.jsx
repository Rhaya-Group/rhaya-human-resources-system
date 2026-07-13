// frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAuth } from "./hooks/useAuth";
import { useTranslation } from "react-i18next";

// Import i18n configuration
import "./i18n";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import OvertimeRequest from "./pages/OvertimeRequest";
import OvertimeHistory from "./pages/OvertimeHistory";
import OvertimeDetail from "./pages/OvertimeDetail";
import OvertimeEdit from "./pages/OvertimeEdit";
import OvertimeActualize from "./pages/OvertimeActualize";
import OvertimeApproval from "./pages/OvertimeApproval";
import MyPayslips from "./pages/MyPayslips";
import PayslipManagement from "./pages/PayslipManagement";
import UserProfile from "./pages/UserProfile";
import UserManagement from "./pages/UserManagement";
import UserDetail from "./pages/UserDetail";
import LeaveHistory from "./pages/LeaveHistory";
import LeaveApproval from "./pages/LeaveApproval";
import OvertimeRecapManagement from "./pages/OvertimeRecapManagement";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LeaveDetail from "./pages/LeaveDetail";
import CompanyDivisionManagement from "./pages/CompanyDivisionManagement";
import EntityGroupManagement from "./pages/EntityGroupManagement";
import PolicyTemplateManagement from "./pages/PolicyTemplateManagement";
import EntitySubgroupManagement from "./pages/EntitySubgroupManagement";
import WorkStatusDashboard from "./pages/WorkStatusDashboard";
import AttendancePermissions from "./pages/AttendancePermissions";
import WfhScheduler from "./pages/WfhScheduler";
import WfhAdmin from "./pages/WfhAdmin";

// Recruitment
import QuestionBank from "./pages/recruitment/QuestionBank";
import JobPostings from "./pages/recruitment/JobPostings";
import Pipeline from "./pages/recruitment/Pipeline";

// Layout
import Layout from "./components/Layout";

// React Query client with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caching configuration
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
      cacheTime: 10 * 60 * 1000, // Cache persists for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnMount: false, // Don't refetch on component mount if data exists
      retry: 1, // Retry failed requests once

      // Keep previous data while fetching new data
      keepPreviousData: true,
    },
    mutations: {
      // Automatically refetch related queries after mutations
      retry: 1,
    },
  },
});

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function SmartDashboard() {
  const { user } = useAuth();

  // Redirect Admin/HR (Level 1-2) to User Management
  if (user?.accessLevel >= 1 && user?.accessLevel <= 2) {
    return <Navigate to="/users/manage" replace />;
  }

  // Regular employees go to Dashboard
  return <Dashboard />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SmartDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave/history"
            element={
              <ProtectedRoute>
                <LeaveHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave/approval"
            element={
              <ProtectedRoute>
                <LeaveApproval />
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave/:requestId"
            element={
              <ProtectedRoute>
                <LeaveDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/request"
            element={
              <ProtectedRoute>
                <OvertimeRequest />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/history"
            element={
              <ProtectedRoute>
                <OvertimeHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/detail/:requestId"
            element={
              <ProtectedRoute>
                <OvertimeDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/edit/:requestId"
            element={
              <ProtectedRoute>
                <OvertimeEdit />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/actualize/:requestId"
            element={
              <ProtectedRoute>
                <OvertimeActualize />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/approval"
            element={
              <ProtectedRoute>
                <OvertimeApproval />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payslips/my-payslips"
            element={
              <ProtectedRoute>
                <MyPayslips />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payslips/manage"
            element={
              <ProtectedRoute requiredLevel={2}>
                <PayslipManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users/manage"
            element={
              <ProtectedRoute requiredLevel={2}>
                <UserManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users/:userId"
            element={
              <ProtectedRoute requiredLevel={2}>
                <UserDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/company-division"
            element={
              <ProtectedRoute requiredLevel={2}>
                <CompanyDivisionManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings/entity-groups"
            element={
              <ProtectedRoute allowedLevels={[1]}>
                <EntityGroupManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings/entity-policies"
            element={
              <ProtectedRoute allowedLevels={[1]}>
                <PolicyTemplateManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings/entity-subgroups"
            element={
              <ProtectedRoute allowedLevels={[1]}>
                <EntitySubgroupManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overtime/recap-management"
            element={
              <ProtectedRoute requiredLevel={2}>
                <OvertimeRecapManagement />
              </ProtectedRoute>
            }
          />

          {/* Work Status / Attendance */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <WorkStatusDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance/permissions"
            element={
              <ProtectedRoute allowedLevels={[1]}>
                <AttendancePermissions />
              </ProtectedRoute>
            }
          />

          <Route
            path="/wfh"
            element={
              <ProtectedRoute>
                <WfhScheduler />
              </ProtectedRoute>
            }
          />

          <Route
            path="/wfh/admin"
            element={
              <ProtectedRoute allowedLevels={[1, 2]}>
                <WfhAdmin />
              </ProtectedRoute>
            }
          />

          {/* Recruitment */}
          <Route
            path="/recruitment/questions"
            element={
              <ProtectedRoute allowedLevels={[1, 2]}>
                <QuestionBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recruitment/jobs"
            element={
              <ProtectedRoute allowedLevels={[1, 2]}>
                <JobPostings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recruitment/jobs/:id/pipeline"
            element={
              <ProtectedRoute allowedLevels={[1, 2]}>
                <Pipeline />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      {/* React Query DevTools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
