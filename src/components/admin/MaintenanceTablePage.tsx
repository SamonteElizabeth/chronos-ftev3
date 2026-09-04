import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Tag, Building2 } from 'lucide-react';
import { TaskNameManagementPage } from './TaskNameManagementPage';
import { DepartmentManagementPage } from './DepartmentManagementPage';

interface MaintenanceTablePageProps {
  initialSubTab?: 'task-names' | 'departments';
}

export const MaintenanceTablePage: React.FC<MaintenanceTablePageProps> = ({
  initialSubTab = 'task-names',
}) => {
  const { currentUser } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';
  const isDeptManager = currentUser.role === 'DEPT_MANAGER';

  const [activeSubTab, setActiveSubTab] = useState<'task-names' | 'departments'>(
    isDeptManager ? 'task-names' : initialSubTab
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(isDeptManager ? 'task-names' : initialSubTab);
    }
  }, [initialSubTab, isDeptManager]);

  return (
    <div className="space-y-6">
      {/* Sub-module Switcher Tabs for Admin */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <button
            type="button"
            onClick={() => setActiveSubTab('task-names')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'task-names'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Task Name</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('departments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'departments'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Department</span>
          </button>
        </div>
      )}

      {/* Sub-module Content */}
      {activeSubTab === 'task-names' || isDeptManager ? (
        <TaskNameManagementPage />
      ) : (
        <DepartmentManagementPage />
      )}
    </div>
  );
};
