import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  X,
  AlertCircle,
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

  const isAdmin = currentUser.role === 'ADMIN';
  const isDeptManager = currentUser.role === 'DEPT_MANAGER';
  const canManage = isAdmin || isDeptManager;

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

    const updatedList = categoryConfig.taskTypes.map(t =>
      t === editingTaskName ? trimmed : t
    );
    updateCategoryConfig({
      taskTypes: updatedList,
    });

    // Update existing tasks matching old name
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Task Name Maintenance Table
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage the list of task names
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setNewTaskName('');
              setModalError('');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Task Name</span>
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Task Name List</h2>
            <p className="text-xs text-slate-500 mt-0.5">List of all task names</p>
          </div>

          {categoryConfig.taskTypes.length > 4 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search task names..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
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
          )}
        </div>

        {/* Card Body */}
        {filteredTaskNames.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-slate-400">
              {searchQuery ? 'No task names matching your search.' : 'No task names added yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6 w-16 text-slate-400 font-medium">#</th>
                  <th className="py-3.5 px-6">Task Name</th>
                  {canManage && <th className="py-3.5 px-6 w-28 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTaskNames.map((taskName, index) => {
                  return (
                    <tr
                      key={taskName}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        {taskName}
                      </td>
                      {canManage && (
                        <td className="py-3.5 px-6 text-right">
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Task Name Modal */}
      {(isCreateModalOpen || editingTaskName) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative border border-slate-100 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingTaskName ? 'Edit Task Name' : 'Add Task Name'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingTaskName(null);
                  setModalError('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={e => {
                if (editingTaskName) {
                  handleSaveEdit(e);
                } else {
                  e.preventDefault();
                  handleAddTaskName(newTaskName);
                }
              }}
            >
              <div className="my-3">
                <input
                  type="text"
                  placeholder="Task name"
                  value={editingTaskName ? editValue : newTaskName}
                  onChange={e => {
                    if (editingTaskName) {
                      setEditValue(e.target.value);
                    } else {
                      setNewTaskName(e.target.value);
                    }
                    if (modalError) setModalError('');
                  }}
                  className={`w-full px-3.5 py-2.5 border ${
                    modalError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  } rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  autoFocus
                />
                {modalError && (
                  <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {modalError}
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingTaskName(null);
                    setModalError('');
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Save
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
        title={`Remove Task Name "${nameToDelete}"?`}
        message={`Are you sure you want to remove task name "${nameToDelete}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
