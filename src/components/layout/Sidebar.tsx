import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Role } from '../../types';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  ClockAlert,
  PieChart,
  Users,
  Building2,
  Tag,
  Table,
  ChevronDown,
  ChevronRight,
  Square,
} from 'lucide-react';
import { formatSecondsToTimer } from '../../utils/calculations';

export type TabType =
  | 'dashboard'
  | 'tasks'
  | 'timetracking'
  | 'timecorrection'
  | 'fte'
  | 'users'
  | 'maintenance';

export type MaintenanceSubTab = 'task-names' | 'departments';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType, subTab?: MaintenanceSubTab) => void;
  maintenanceSubTab?: MaintenanceSubTab;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar = ({
  activeTab,
  setActiveTab,
  maintenanceSubTab = 'task-names',
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) => {
  const {
    currentUser,
    activeTimer,
    activeTimerTask,
    timerElapsedSeconds,
    stopTimer,
  } = useApp();

  const role = currentUser.role;
  const [isMaintenanceExpanded, setIsMaintenanceExpanded] = useState(activeTab === 'maintenance');

  // Keep expanded if maintenance tab becomes active
  React.useEffect(() => {
    if (activeTab === 'maintenance') {
      setIsMaintenanceExpanded(true);
    }
  }, [activeTab]);

  interface NavItem {
    id: TabType;
    label: string;
    icon: React.ReactNode;
    allowedRoles: Role[];
    badge?: string;
  }

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Analytics',
      icon: <LayoutDashboard className="w-4 h-4" />,
      allowedRoles: ['MANAGER', 'DEPT_MANAGER', 'TASK_USER'],
    },
    {
      id: 'tasks',
      label: 'Task Management',
      icon: <CheckSquare className="w-4 h-4" />,
      allowedRoles: ['MANAGER', 'DEPT_MANAGER', 'TASK_USER'],
    },
    {
      id: 'timetracking',
      label: 'Task Execution',
      icon: <Clock className="w-4 h-4" />,
      allowedRoles: ['MANAGER', 'DEPT_MANAGER', 'TASK_USER'],
    },
    {
      id: 'timecorrection',
      label: 'Time Correction',
      icon: <ClockAlert className="w-4 h-4" />,
      allowedRoles: ['MANAGER', 'DEPT_MANAGER', 'TASK_USER'],
    },
    {
      id: 'fte',
      label: 'FTE & Utilization',
      icon: <PieChart className="w-4 h-4" />,
      allowedRoles: ['MANAGER', 'DEPT_MANAGER'],
    },
    {
      id: 'users',
      label: 'User Management',
      icon: <Users className="w-4 h-4" />,
      allowedRoles: ['ADMIN'],
    },
  ];

  const filteredNavItems = navItems.filter(item => item.allowedRoles.includes(role));

  const handleNavClick = (tab: TabType, subTab?: MaintenanceSubTab) => {
    setActiveTab(tab, subTab);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#1E293B] text-slate-200 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Title */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-700/60 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-base shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-white font-semibold text-base leading-tight uppercase tracking-tight">
              Chronos v3
            </h1>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1.5">
          {filteredNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-500 text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:bg-[#334155] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Maintenance Table Module (Admin & Dept Manager) */}
          {(role === 'ADMIN' || role === 'DEPT_MANAGER') && (
            <div className="pt-1">
              {/* Maintenance Table Parent Item */}
              <div
                className={`rounded-lg transition-all ${
                  activeTab === 'maintenance' ? 'bg-[#334155]/60' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (activeTab !== 'maintenance') {
                        handleNavClick('maintenance', role === 'DEPT_MANAGER' ? 'task-names' : maintenanceSubTab);
                        setIsMaintenanceExpanded(true);
                      } else {
                        setIsMaintenanceExpanded(!isMaintenanceExpanded);
                      }
                    }}
                    className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'maintenance'
                        ? 'text-white font-semibold'
                        : 'text-[#94A3B8] hover:bg-[#334155] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Table className={`w-4 h-4 ${activeTab === 'maintenance' ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span>Maintenance Table</span>
                    </div>
                    <span className="p-0.5 text-slate-400 hover:text-white transition-colors">
                      {isMaintenanceExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                </div>

                {/* Sub-modules - shown once clicked / expanded */}
                {isMaintenanceExpanded && (
                  <div className="ml-5 pl-3 border-l border-slate-700/80 my-1 space-y-1">
                    {/* Sub-module: Task Name */}
                    <button
                      onClick={() => handleNavClick('maintenance', 'task-names')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        activeTab === 'maintenance' && maintenanceSubTab === 'task-names'
                          ? 'bg-blue-500 text-white font-semibold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#334155]'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Task Name</span>
                    </button>

                    {/* Sub-module: Department (Admin Only) */}
                    {role === 'ADMIN' && (
                      <button
                        onClick={() => handleNavClick('maintenance', 'departments')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          activeTab === 'maintenance' && maintenanceSubTab === 'departments'
                            ? 'bg-blue-500 text-white font-semibold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#334155]'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Department</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Active Timer Sidebar Card */}
        {role !== 'ADMIN' && activeTimer && activeTimerTask && (
          <div className="p-3.5 mx-4 mb-3 bg-slate-900/90 border border-blue-500/30 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Active Timer
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {formatSecondsToTimer(timerElapsedSeconds)}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mb-2.5">
              {activeTimerTask.taskName}
            </p>
            <button
              onClick={() => stopTimer()}
              className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-white" /> Stop Timer
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
