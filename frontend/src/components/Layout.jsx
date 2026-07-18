// frontend/src/components/Layout.jsx
// MOBILE-RESPONSIVE VERSION - Hamburger menu + sliding drawer on mobile

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";
import LanguageToggle from "./LanguageToggle";
import { useInternalPolicyUrl } from "../hooks/useInternalPolicyUrl";
import { Shield, Monitor, Briefcase } from "lucide-react";

// Icons
const DashboardIcon = () => (
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
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const ClockIcon = () => (
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
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const CalendarIcon = () => (
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
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const CheckCircleIcon = () => (
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
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const UsersIcon = () => (
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
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

// Money/Currency Icon for Payslips
const MoneyIcon = () => (
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
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const DocumentIcon = () => (
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
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const UserIcon = () => (
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
      d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const BuildingIcon = () => (
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
      d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
    />
  </svg>
);

const MegaphoneIcon = () => (
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
      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
    />
  </svg>
);

const AttendanceIcon = () => (
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
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

// Hamburger Menu Icon
const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

// Close Icon
const CloseIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { url: policyUrl, label: policyLabel } = useInternalPolicyUrl();
  const { t } = useTranslation();

  // Desktop: sidebar can be collapsed
  // Mobile: sidebar is drawer (always starts closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecruitmentOpen, setIsRecruitmentOpen] = useState(false);
  const [hasSubordinates, setHasSubordinates] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  // Check if user has subordinates
  useEffect(() => {
    const checkSubordinates = async () => {
      if (user?.id) {
        try {
          // Check subordinates for employee level <= 4
          // This prevents 403 error for interns (level 5)
          // Access levels: 1=Admin, 2=Subsidiary, 3=Manager, 4=Staff, 5=Intern
          if (user.accessLevel && user.accessLevel <= 4) {
            const response = await apiClient.get("/users/has-subordinates");
            setHasSubordinates(response.data.hasSubordinates);
          } else {
            // Intern (level 5) - no subordinates check
            setHasSubordinates(false);
          }
        } catch (error) {
          // Only log error for users who should have access (level <= 4)
          if (user.accessLevel && user.accessLevel <= 4) {
            console.error(
              "Error checking subordinates:",
              error.response?.data || error.message,
            );
          }
          setHasSubordinates(false);
        }
      }
    };

    checkSubordinates();
  }, [user]);

  // Check if on approval routes
  const isOnApprovalRoute = location.pathname.includes("/approval");

  // Build navigation items based on user access level
  const navItems = [];

  // EMPLOYEE MENUS (Level 3, 4, 5)
  if (user?.accessLevel >= 3 && user?.accessLevel <= 5) {
    navItems.push(
      {
        path: "/",
        label: t("nav.dashboard"),
        icon: DashboardIcon,
        type: "link",
      },
      {
        path: "/overtime/history",
        label: t("nav.overtime"),
        icon: ClockIcon,
        type: "link",
      },
      {
        path: "/leave/history",
        label: t("nav.leave"),
        icon: CalendarIcon,
        type: "link",
      },
      {
        path: "/payslips/my-payslips",
        label: t("nav.payslips"),
        icon: MoneyIcon,
        type: "link",
      },
      {
        path: "/profile",
        label: t("nav.profile"),
        icon: UserIcon,
        type: "link",
      },
    );
  }

  // APPROVAL MENU (Level 3, 4 with conditions)
  if (user?.accessLevel >= 1 && user?.accessLevel <= 4) {
    const approvalChildren = [];

    // Overtime Approval - Level 1-4
    if (user?.accessLevel >= 1 && user?.accessLevel <= 4) {
      // For Level 4 (Staff), only show if they have subordinates
      if (user?.accessLevel === 4) {
        if (hasSubordinates) {
          approvalChildren.push({
            path: "/overtime/approval",
            label: t("nav.overtimeApproval"),
          });
        }
      } else {
        // Level 1-3 always have overtime approval
        approvalChildren.push({
          path: "/overtime/approval",
          label: t("nav.overtimeApproval"),
        });
      }
    }

    // Leave Approval - Level 1-3 only (NOT Level 4)
    // if (user?.accessLevel >= 1 && user?.accessLevel <= 3) {
    //   approvalChildren.push({
    //     path: '/leave/approval',
    //     label: t('nav.leaveApproval')
    //   });
    // }

    // Leave Approval - Level 1-4
    if (user?.accessLevel >= 1 && user?.accessLevel <= 4) {
      // For Level 4 (Staff), only show if they have subordinates
      if (user?.accessLevel === 4) {
        if (hasSubordinates) {
          approvalChildren.push({
            path: "/leave/approval",
            label: t("nav.leaveApproval"),
          });
        }
      } else {
        // Level 1-3 always have leave approval
        approvalChildren.push({
          path: "/leave/approval",
          label: t("nav.leaveApproval"),
        });
      }
    }

    // ADMIN/HR MENUS (Level 1, 2)
    if (user?.accessLevel >= 1 && user?.accessLevel <= 2) {
      navItems.push({
        path: "/users/manage",
        label: t("nav.userManagement"),
        icon: UsersIcon,
        type: "link",
      });
      navItems.push({
        path: "/admin/company-division",
        label: t("nav.companyDivisionManagement"),
        icon: BuildingIcon,
        type: "link",
      });
      navItems.push({
        path: "/announcements/manage",
        label: "Announcements",
        icon: MegaphoneIcon,
        type: "link",
      });
    }

    // Only add Approval dropdown if there are children
    if (approvalChildren.length > 0) {
      navItems.push({
        label: t("nav.approval"),
        icon: CheckCircleIcon,
        type: "dropdown",
        isOpen: isApprovalOpen,
        toggle: () => setIsApprovalOpen(!isApprovalOpen),
        children: approvalChildren,
      });
    }
  }

  // PAYSLIPS MANAGEMENT (Level 1, 2)
  if (user?.accessLevel >= 1 && user?.accessLevel <= 2) {
    navItems.push({
      path: "/payslips/manage",
      label: t("nav.payslipManagement"),
      icon: MoneyIcon,
      type: "link",
    });
  }

  // OVERTIME RECAP (Level 1, 2)
  if (user?.accessLevel >= 1 && user?.accessLevel <= 2) {
    navItems.push({
      path: "/overtime/recap-management",
      label: t("nav.overtimeRecap"),
      icon: ClockIcon,
      type: "link",
    });
  }

  // ATTENDANCE GROUP (Admin: dropdown; Employee: flat links)
  if (user?.accessLevel <= 2) {
    // Admin: Attendance dropdown — Work Status + WFH Management + (L1) Attendance Access
    const attendanceChildren = [
      { path: "/attendance", label: "Work Status" },
      { path: "/wfh/admin",  label: "WFH Management" },
    ];
    if (user?.accessLevel === 1) {
      attendanceChildren.push({ path: "/attendance/permissions", label: "Attendance Access" });
    }
    navItems.push({
      label: "Attendance",
      icon: AttendanceIcon,
      type: "dropdown",
      isOpen: isAttendanceOpen,
      toggle: () => setIsAttendanceOpen(!isAttendanceOpen),
      children: attendanceChildren,
    });
  } else {
    // Employee: flat Work Status link
    navItems.push({
      path: "/attendance",
      label: "Work Status",
      icon: AttendanceIcon,
      type: "link",
    });
  }

  // WFH SCHEDULER — employee picker (non-admin only; page handles scope check)
  if (user?.accessLevel > 2) {
    navItems.push({
      path: "/wfh",
      label: "WFH Schedule",
      icon: Monitor,
      type: "link",
    });
  }

  // RECRUITMENT (Level 1–2 — HR can manage question bank, pipeline, overseers)
  if (user?.accessLevel <= 2) {
    navItems.push({
      label: "Recruitment",
      icon: Briefcase,
      type: "dropdown",
      isOpen: isRecruitmentOpen,
      toggle: () => setIsRecruitmentOpen(!isRecruitmentOpen),
      children: [
        { path: "/recruitment/candidates", label: "Candidate Pool" },
        { path: "/recruitment/documents", label: "Documents" },
        { path: "/recruitment/jobs", label: "Job Postings" },
        { path: "/recruitment/questions", label: "Question Bank" },
      ],
    });
  }

  // SETTINGS (Level 1 only — entity config)
  if (user?.accessLevel === 1) {
    navItems.push({
      label: "Settings",
      icon: Shield,
      type: "dropdown",
      isOpen: isSettingsOpen,
      toggle: () => setIsSettingsOpen(!isSettingsOpen),
      children: [
        { path: "/settings/entity-groups",    label: "Entity Groups" },
        { path: "/settings/entity-subgroups", label: "Entity Sub-groups" },
        { path: "/settings/entity-policies",  label: "Entity Policies" },
      ],
    });
  }

  // INTERNAL POLICY (All users)
  // policyUrl defaults to the company-wide URL immediately (no flicker).
  // If the entity/group has a custom URL configured it overrides after API resolves.
  navItems.push({
    label: t("nav.internalPolicy"),
    icon: DocumentIcon,
    type: "external",
    href: policyUrl || "https://rhayaflicks.com/internalpolicy/",
  });

  // Sidebar Content Component (reused for mobile and desktop)
  const SidebarContent = ({ isMobile = false }) => (
    <>
      {/* Logo/Header */}
      <div className="p-4 border-b">
        {isMobile || isSidebarOpen ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xl">HR</span>
              </div>
              <div>
                <h1 className="font-bold text-lg leading-5">
                  {t("login.title")}
                </h1>
                <p className="text-xs text-gray-500">Rhaya Group</p>
              </div>
            </div>
            {/* Close button for mobile, collapse for desktop */}
            {isMobile ? (
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            ) : (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors hidden lg:flex"
                title="Collapse sidebar"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        ) : (
          /* Collapsed desktop - Logo becomes expand button */
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors mx-auto"
            title="Expand sidebar"
          >
            <span className="text-white font-bold text-xl">HR</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {navItems.map((item, index) => {
          if (item.type === "dropdown") {
            const Icon = item.icon;
            const hasActiveChild = item.children?.some(
              (child) => location.pathname === child.path,
            );

            return (
              <div key={index}>
                <button
                  onClick={item.toggle}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    hasActiveChild || isOnApprovalRoute
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon />
                    {(isMobile || isSidebarOpen) && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </div>
                  {(isMobile || isSidebarOpen) &&
                    (item.isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />)}
                </button>

                {/* Dropdown Items */}
                {(isMobile || isSidebarOpen) &&
                  item.isOpen &&
                  item.children && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? "bg-blue-100 text-blue-700 font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-gray-400 mr-3"></span>
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          }

          // Check if external link
          if (item.type === "external") {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon />
                {(isMobile || isSidebarOpen) && (
                  <>
                    <span className="font-medium">{item.label}</span>
                    <svg
                      className="w-4 h-4 ml-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </>
                )}
              </a>
            );
          }

          // Regular link
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon />
              {(isMobile || isSidebarOpen) && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info at Bottom */}
      <div className="border-t bg-white p-4 space-y-3">
        {/* Language Toggle */}
        <LanguageToggle isSidebarOpen={isMobile || isSidebarOpen} />

        {isMobile || isSidebarOpen ? (
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.role?.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 flex items-center justify-center space-x-2 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>{t("nav.logout")}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-10 h-10 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors"
              title={t("nav.logout")}
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* MOBILE: Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* MOBILE: Sliding Drawer Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          lg:hidden
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col">
          <SidebarContent isMobile={true} />
        </div>
      </aside>

      {/* DESKTOP: Regular Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col relative bg-white shadow-lg
          transition-all duration-300
          ${isSidebarOpen ? "w-64" : "w-20"}
        `}
      >
        <SidebarContent isMobile={false} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MOBILE: Top Header Bar with Hamburger */}
        <header className="lg:hidden bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">HR</span>
            </div>
            <div>
              <h1 className="font-bold text-sm">{t("login.title")}</h1>
            </div>
          </div>

          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-xs">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
