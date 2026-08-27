import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Role } from '../../types';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Search,
  X,
  CalendarCheck,
} from 'lucide-react';
import { WorkScheduleSettingsModal } from '../common/WorkScheduleSettingsModal';

export const UserManagementPage: React.FC = () => {
  const {
    users,
    departments,
    workingSchedules,
    createUser,
    updateUser,
    currentUser,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [scheduleModalUser, setScheduleModalUser] = useState<User | null>(null);

  // Form states
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TASK_USER');
  const [departmentId, setDepartmentId] = useState('');
  const [title, setTitle] = useState('');
  const [workingScheduleId, setWorkingScheduleId] = useState('SCH-001');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredUsers = users.filter(u => {
    if (selectedDept && u.departmentId !== selectedDept) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.employeeId.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setEmployeeId(`EMP-${String(users.length + 1).padStart(3, '0')}`);
    setName('');
    setEmail('');
    setRole('TASK_USER');
    setDepartmentId(departments[0]?.id || 'DEPT-001');
    setTitle('');
    setWorkingScheduleId(workingSchedules[0]?.id || 'SCH-001');
    setStatus('Active');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEmployeeId(u.employeeId);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setDepartmentId(u.departmentId);
    setTitle(u.title);
    setWorkingScheduleId(u.workingScheduleId);
    setStatus(u.status);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required.';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid email is required.';
    if (!departmentId) errs.departmentId = 'Department is required.';
    if (!title.trim()) errs.title = 'Job title is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (editingUser) {
      updateUser(editingUser.id, {
        name,
        email,
        role,
        departmentId,
        title,
        workingScheduleId,
        status,
      });
    } else {
      createUser({
        employeeId,
        name,
        email,
        role,
        departmentId,
        title,
        workingScheduleId,
        status,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            User Management & Role Access Control
          </h2>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>

          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-500 font-medium">
          Total Users: <strong className="text-slate-800">{filteredUsers.length}</strong>
        </span>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee ID</th>
                <th className="py-3 px-4 font-semibold">Name & Email</th>
                <th className="py-3 px-4 font-semibold">Job Title</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold">Schedule</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => {
                const dept = departments.find(d => d.id === user.departmentId);
                const sched = workingSchedules.find(s => s.id === user.workingScheduleId);

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                      {user.employeeId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-[10px] text-slate-400">{user.email}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{user.title}</td>
                    <td className="py-3 px-4 text-slate-600">{dept?.name || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-mono text-[11px]">{sched?.name}</span> ({sched?.hoursPerDay}h/d)
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'ADMIN'
                            ? 'bg-rose-100 text-rose-800'
                            : user.role === 'MANAGER'
                            ? 'bg-blue-100 text-blue-800'
                            : user.role === 'DEPT_MANAGER'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {user.role === 'DEPT_MANAGER'
                          ? 'DEPT MGR'
                          : user.role === 'TASK_USER'
                          ? 'TASK USER'
                          : user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          user.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setScheduleModalUser(user)}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Configure Work Schedule"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
                            updateUser(user.id, { status: newStatus });
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.status === 'Active'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={user.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.status === 'Active' ? (
                            <XCircle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 text-slate-800 animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Edit User Account' : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    disabled={!!editingUser}
                    onChange={e => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    System Role & Access Scope <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TASK_USER">Task User (Individual - Own Tasks & Timer)</option>
                    <option value="DEPT_MANAGER">Department Manager (Department-level Oversight)</option>
                    <option value="MANAGER">Manager (Global / Organization-wide Oversight)</option>
                    <option value="ADMIN">Admin-wide (Full System Configuration & Access)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Johnathan Doe"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && <p className="text-rose-500 text-[11px] mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Corporate Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john.doe@enterprise.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.email && <p className="text-rose-500 text-[11px] mt-1">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Business Analyst"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.title && <p className="text-rose-500 text-[11px] mt-1">{errors.title}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Working Schedule
                  </label>
                  <select
                    value={workingScheduleId}
                    onChange={e => setWorkingScheduleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {workingSchedules.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.hoursPerDay}h/d)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-xs"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work Schedule Settings Modal for Selected User */}
      <WorkScheduleSettingsModal
        isOpen={Boolean(scheduleModalUser)}
        onClose={() => setScheduleModalUser(null)}
        targetUser={scheduleModalUser}
      />
    </div>
  );
};
