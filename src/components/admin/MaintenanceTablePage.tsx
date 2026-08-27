import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Tag, Building2, Table, Layers } from 'lucide-react';
import { CategoryManagementPage } from './CategoryManagementPage';
import { DepartmentManagementPage } from './DepartmentManagementPage';

interface MaintenanceTablePageProps {
  initialSubTab?: 'task-names' | 'departments';
}

export const MaintenanceTablePage: React.FC<MaintenanceTablePageProps> = ({
  initialSubTab = 'task-names',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'task-names' | 'departments'>(initialSubTab);
  const { categoryConfig, departments } = useApp();

  return (
    <div className="space-y-6">
      {/* Header & Sub-module Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" />
              Maintenance Table
            </h1>
          </div>

          {/* Sub-module Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl text-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveSubTab('task-names')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'task-names'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-blue-500" />
              <span>Task Name</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 font-bold ml-1">
                {categoryConfig.taskTypes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('departments')}
              className={`px-3.5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'departments'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Department</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-bold ml-1">
                {departments.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-module Content */}
      {activeSubTab === 'task-names' ? (
        <CategoryManagementPage />
      ) : (
        <DepartmentManagementPage />
      )}
    </div>
  );
};
