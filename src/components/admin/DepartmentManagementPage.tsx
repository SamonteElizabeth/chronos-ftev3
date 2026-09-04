import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Department } from '../../types';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

export const DepartmentManagementPage: React.FC = () => {
  const {
    departments,
    users,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    showToast,
    currentUser,
  } = useApp();

  const isAdmin = currentUser.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [modalError, setModalError] = useState('');

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return departments;
    const q = search.trim().toLowerCase();
    return departments.filter(d => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  // Potential managers list
  const potentialManagers = useMemo(() => {
    return users.filter(
      u => u.status === 'Active' && (u.role === 'DEPT_MANAGER' || u.role === 'MANAGER' || u.role === 'ADMIN')
    );
  }, [users]);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setManagerId(potentialManagers[0]?.id || '');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setManagerId(dept.managerId);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setModalError('Department name is required.');
      return;
    }

    if (editingDept) {
      updateDepartment(editingDept.id, {
        name: trimmedName,
        managerId,
      });
      showToast('success', 'Department Updated', `${trimmedName} was updated successfully.`);
    } else {
      const generatedCode = `DEP-${String(departments.length + 1).padStart(3, '0')}`;
      createDepartment({
        name: trimmedName,
        code: generatedCode,
        managerId,
        status: 'Active',
        description: '',
      });
      showToast('success', 'Department Created', `${trimmedName} was added successfully.`);
    }

    setIsModalOpen(false);
    setEditingDept(null);
    setModalError('');
  };

  const getManagerName = (mId: string) => {
    const mgr = users.find(u => u.id === mId);
    return mgr ? mgr.name : 'Unassigned';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Department Maintenance Table
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage the list of departments
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Department</span>
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Department List</h2>
            <p className="text-xs text-slate-500 mt-0.5">List of all departments</p>
          </div>

          {departments.length > 3 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search departments..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card Body */}
        {filteredDepts.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-slate-400">
              {search ? 'No departments matching your search.' : 'No departments added yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6 w-16 text-slate-400 font-medium">#</th>
                  <th className="py-3.5 px-6">Department Name</th>
                  <th className="py-3.5 px-6">Department Manager</th>
                  {isAdmin && <th className="py-3.5 px-6 w-28 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepts.map((dept, index) => (
                  <tr
                    key={dept.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {dept.name}
                    </td>
                    <td className="py-3.5 px-6 text-slate-700">
                      {getManagerName(dept.managerId)}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(dept)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={`Edit Department "${dept.name}"`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeptToDelete(dept)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete Department "${dept.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative border border-slate-100 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingDept ? 'Edit Department' : 'Add Department'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingDept(null);
                  setModalError('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4 my-3">
              <div>
                <input
                  type="text"
                  placeholder="Department name"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (modalError) setModalError('');
                  }}
                  className={`w-full px-3.5 py-2.5 border ${
                    modalError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  } rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  autoFocus
                />
              </div>

              <div>
                <select
                  value={managerId}
                  onChange={e => setManagerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select Department Manager...</option>
                  {potentialManagers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {modalError && (
                <p className="text-xs text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {modalError}
                </p>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingDept(null);
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

      {/* Delete Department Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deptToDelete}
        onClose={() => setDeptToDelete(null)}
        onConfirm={() => {
          if (deptToDelete) {
            deleteDepartment(deptToDelete.id);
            showToast('success', 'Department Deleted', `${deptToDelete.name} has been removed.`);
            setDeptToDelete(null);
          }
        }}
        title={`Delete Department "${deptToDelete?.name || ''}"?`}
        message={`Are you sure you want to remove ${deptToDelete?.name}?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
