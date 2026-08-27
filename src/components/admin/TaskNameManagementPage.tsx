import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  RotateCcw,
  Layers,
  X,
  AlertCircle,
  Hash,
  Activity,
  Check,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

export const TaskNameManagementPage: React.FC = () => {
  const {
    categoryConfig,
    updateCategoryConfig,
    currentUser,
    tasks,
    updateTask,
    showToast,
  } = useApp();

  const [newTaskName, setNewTaskName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTaskName, setEditingTaskName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [modalError, setModalError] = useState('');
  
  const [nameToDelete, setNameToDelete] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const isAdmin = currentUser.role === 'ADMIN';

  // Calculate usage counts for all task names
  const taskUsageMap = useMemo(() => {
    const map: Record<string, number> = {};
    categoryConfig.taskTypes.forEach(name => {
      map[name] = 0;
    });
    tasks.forEach(t => {
      // Check exact match or type match
      const matchingType = categoryConfig.taskTypes.find(
        name =>
          name.toLowerCase() === t.taskName.toLowerCase() ||
          name.toLowerCase() === t.taskType?.toLowerCase()
      );
      if (matchingType) {
        map[matchingType] = (map[matchingType] || 0) + 1;
      }
    });
    return map;
  }, [categoryConfig.taskTypes, tasks]);

  // Filtered task names
  const filteredTaskNames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categoryConfig.taskTypes;
    return categoryConfig.taskTypes.filter(name =>
      name.toLowerCase().includes(query)
    );
  }, [categoryConfig.taskTypes, searchQuery]);

  // Handle adding a task name
  const handleAddTaskName = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) {
      setModalError('Task Name cannot be empty.');
      return false;
    }

    if (
      categoryConfig.taskTypes.some(
        t => t.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      const errMsg = `Task Name "${trimmed}" already exists in the master list.`;
      setModalError(errMsg);
      showToast('error', 'Duplicate Task Name', errMsg);
      return false;
    }

    const updatedList = [...categoryConfig.taskTypes, trimmed];
    updateCategoryConfig({
      taskTypes: updatedList,
    });

    showToast(
      'success',
      'Task Name Created',
      `Master Task Name "${trimmed}" has been added successfully.`
    );
    setNewTaskName('');
    setIsCreateModalOpen(false);
    setModalError('');
    return true;
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddTaskName(newTaskName);
  };

  // Handle opening edit modal
  const handleOpenEdit = (taskName: string) => {
    setEditingTaskName(taskName);
    setEditValue(taskName);
    setModalError('');
  };

  // Handle saving edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskName) return;

    const trimmed = editValue.trim();
    if (!trimmed) {
      setModalError('Task Name cannot be empty.');
      return;
    }

    if (
      trimmed.toLowerCase() !== editingTaskName.toLowerCase() &&
      categoryConfig.taskTypes.some(
        t => t.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setModalError(`Task Name "${trimmed}" already exists.`);
      return;
    }

    // Update in categoryConfig
    const updatedList = categoryConfig.taskTypes.map(t =>
      t === editingTaskName ? trimmed : t
    );
    updateCategoryConfig({
      taskTypes: updatedList,
    });

    // Optionally update existing tasks matching the old name
    tasks.forEach(t => {
      if (t.taskName === editingTaskName) {
        updateTask(t.id, { taskName: trimmed });
      }
    });

    showToast(
      'success',
      'Task Name Updated',
      `Renamed "${editingTaskName}" to "${trimmed}".`
    );
    setEditingTaskName(null);
    setEditValue('');
    setModalError('');
  };

  // Handle deleting a task name
  const handleDeleteTaskName = (taskName: string) => {
    setNameToDelete(taskName);
  };

  const confirmDeleteTaskName = () => {
    if (!nameToDelete) return;
    const updatedList = categoryConfig.taskTypes.filter(t => t !== nameToDelete);
    updateCategoryConfig({
      ...categoryConfig,
      taskTypes: updatedList,
    });
    showToast(
      'info',
      'Task Name Removed',
      `Master Task Name "${nameToDelete}" was removed.`
    );
    setNameToDelete(null);
  };

  // Reset defaults
  const handleResetDefaults = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetDefaults = () => {
    const defaultTypes = [
      'Analysis',
      'Development',
      'Testing',
      'Documentation',
      'Meeting',
      'Support',
      'Review',
      'Planning',
      'Administrative',
      'Training',
    ];
    updateCategoryConfig({
      ...categoryConfig,
      taskTypes: defaultTypes,
    });
    showToast(
      'success',
      'Reset Completed',
      'Task names have been reset to standard defaults.'
    );
    setIsResetConfirmOpen(false);
  };

  const totalUsage = Object.values(taskUsageMap).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-600" />
            Task Name
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isAdmin && (
            <>
              <button
                onClick={handleResetDefaults}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Reset to default task names"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset Defaults</span>
              </button>

              <button
                onClick={() => {
                  setModalError('');
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task Name</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {categoryConfig.taskTypes.length}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total Master Task Names
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalUsage}</div>
            <div className="text-xs text-slate-500 font-medium">
              Active Linked Tasks
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              {filteredTaskNames.length}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Filtered Records
            </div>
          </div>
        </div>
      </div>

      {/* Main Directory Table / List Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header with Search & Quick Inline Add */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Master Task Names Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select, search, create, or update system task classifications
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search task names..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Inline Creation Form for Admins */}
        {isAdmin && (
          <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100">
            <form onSubmit={handleInlineSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="Enter new Task Name (e.g., Code Review, Security Audit, Cloud Migration)..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-2xs font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task Name</span>
              </button>
            </form>
          </div>
        )}

        {/* Task Names Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-16 text-center">#</th>
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4 w-36 text-center">Linked Tasks</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                {isAdmin && <th className="py-3 px-4 w-28 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTaskNames.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-medium text-slate-600">No task names found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try adjusting your search keywords'
                        : 'Create your first master task name using the form above'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTaskNames.map((taskName, index) => {
                  const usage = taskUsageMap[taskName] || 0;

                  return (
                    <tr
                      key={taskName}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-400 text-[11px]">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {taskName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            usage > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {usage} {usage === 1 ? 'task' : 'tasks'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(taskName)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title={`Edit Task Name "${taskName}"`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTaskName(taskName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={`Delete Task Name "${taskName}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Showing <strong className="text-slate-800">{filteredTaskNames.length}</strong> of{' '}
            <strong className="text-slate-800">{categoryConfig.taskTypes.length}</strong> task names
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" /> Master directory synchronized
          </span>
        </div>
      </div>

      {/* Create Task Name Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Tag className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Create Master Task Name
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setModalError('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleAddTaskName(newTaskName);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Task Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={e => {
                    setNewTaskName(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  placeholder="e.g., Security Audit, User Acceptance Testing..."
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    modalError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900`}
                  autoFocus
                />
                {modalError && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {modalError}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">
                  This task name will be available across task creation, employee assignments, and time logs.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setModalError('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTaskName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Create Task Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Name Modal */}
      {editingTaskName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Edit2 className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Task Name
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingTaskName(null);
                  setModalError('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Task Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editValue}
                  onChange={e => {
                    setEditValue(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border ${
                    modalError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900`}
                  autoFocus
                />
                {modalError && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {modalError}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Renaming will update the master catalog and synchronize any matching task references.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskName(null);
                    setModalError('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editValue.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Task Name Modal */}
      <ConfirmModal
        isOpen={!!nameToDelete}
        onClose={() => setNameToDelete(null)}
        onConfirm={confirmDeleteTaskName}
        title={`Remove Master Task Name "${nameToDelete}"?`}
        message={
          (nameToDelete && taskUsageMap[nameToDelete] ? taskUsageMap[nameToDelete] : 0) > 0
            ? `Task Name "${nameToDelete}" is currently assigned to ${taskUsageMap[nameToDelete || '']} task(s). Are you sure you want to remove it from the master catalog?`
            : `Remove master Task Name "${nameToDelete}" from directory?`
        }
        confirmLabel="Remove Task Name"
        variant="danger"
      />

      {/* Reset Defaults Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={confirmResetDefaults}
        title="Reset Task Names to Defaults?"
        message="This will reset the master task names catalog to the standard enterprise defaults."
        confirmLabel="Reset Defaults"
        variant="warning"
      />
    </div>
  );
};
