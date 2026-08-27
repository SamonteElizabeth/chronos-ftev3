import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Department } from '../../types';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Users,
  Briefcase,
  Layers,
  X,
  UserCheck,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

export const DepartmentManagementPage: React.FC = () => {
  const {
    departments,
    users,
    tasks,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredDepts = departments.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Potential managers list
  const potentialManagers = users.filter(
    u => u.status === 'Active' && (u.role === 'DEPT_MANAGER' || u.role === 'MANAGER' || u.role === 'ADMIN')
  );

  const openCreateModal = () => {
    setEditingDept(null);
    setCode(`DEP-00${departments.length + 1}`);
    setName('');
    setManagerId(potentialManagers[0]?.id || '');
    setStatus('Active');
    setDescription('');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setCode(dept.code);
    setName(dept.name);
    setManagerId(dept.managerId);
    setStatus(dept.status);
    setDescription(dept.description || '');
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Department name is required.';
    if (!code.trim()) errs.code = 'Department code is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (editingDept) {
      updateDepartment(editingDept.id, {
        name,
        code,
        managerId,
        status,
        description,
      });
      showToast('success', 'Department Updated', `Department ${name} was successfully updated.`);
    } else {
      createDepartment({
        name,
        code,
        managerId,
        status,
        description,
      });
      showToast('success', 'Department Created', `New department ${name} was created.`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (dept: Department) => {
    const deptUsers = users.filter(u => u.departmentId === dept.id);
    if (deptUsers.length > 0) {
      showToast(
        'error',
        'Cannot Delete Department',
        `Department ${dept.name} has ${deptUsers.length} assigned employees. Reassign them first.`
      );
      return;
    }
    setDeptToDelete(dept);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Department
          </h2>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Departments</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{departments.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Active Departments</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {departments.filter(d => d.status === 'Active').length}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Assigned Employees</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Active Tasks</span>
            <Briefcase className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{tasks.length}</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search departments by name, code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({departments.length})
          </button>
          <button
            onClick={() => setStatusFilter('Active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'Active'
                ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active ({departments.filter(d => d.status === 'Active').length})
          </button>
          <button
            onClick={() => setStatusFilter('Inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === 'Inactive'
                ? 'bg-slate-100 text-slate-800 font-semibold border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Inactive ({departments.filter(d => d.status === 'Inactive').length})
          </button>
        </div>
      </div>

      {/* Department List / Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Department Name & Scope</th>
                <th className="py-3.5 px-4">Department Manager</th>
                <th className="py-3.5 px-4 text-center">Team Members</th>
                <th className="py-3.5 px-4 text-center">Active Tasks</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="font-medium text-slate-600">No departments found</p>
                    <p className="text-[11px] mt-0.5">Try adjusting your search query or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredDepts.map(dept => {
                  const deptManager = users.find(u => u.id === dept.managerId);
                  const deptUsers = users.filter(u => u.departmentId === dept.id);
                  const deptTasks = tasks.filter(t => t.departmentId === dept.id);

                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg text-xs">
                          {dept.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <p className="font-bold text-slate-900 text-xs">{dept.name}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {dept.description || 'No description provided.'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {deptManager ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                              {deptManager.name
                                .split(' ')
                                .map(n => n[0])
                                .join('')
                                .substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-xs truncate">
                                {deptManager.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {deptManager.title || 'Department Manager'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">
                          <Users className="w-3 h-3 text-slate-500" />
                          {deptUsers.length}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          {deptTasks.length}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            dept.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {dept.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(dept)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(dept)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Department"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingDept ? 'Edit Department' : 'Add New Department'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Software Engineering"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.name ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {errors.name && <p className="text-rose-600 text-[11px] mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g., ENG"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {errors.code && <p className="text-rose-600 text-[11px] mt-1">{errors.code}</p>}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department Manager
                </label>
                <select
                  value={managerId}
                  onChange={e => setManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Select Department Manager...</option>
                  {potentialManagers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role} - {m.title})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description & Operational Scope
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Outline the department's mandate and primary responsibilities..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  {editingDept ? 'Save Changes' : 'Create Department'}
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
        message={`Are you sure you want to remove ${deptToDelete?.name} (${deptToDelete?.code})?`}
        confirmLabel="Delete Department"
        variant="danger"
      />
    </div>
  );
};
