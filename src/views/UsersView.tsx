import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { User, Role, UserStatus } from '../types';
import {
  Users,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
  Building2,
  Lock,
  Mail,
  Phone,
  Shield,
  Key,
  CheckCircle2,
  Calendar,
  Activity
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const {
    users,
    organizations,
    addUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    setSelectedUserId,
    setActiveTab,
    auditLogs
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  
  // Modals & Drawer
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [drawerUser, setDrawerUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organizationId: organizations[0]?.id || 'org-apollo',
    role: 'Doctor' as Role,
    status: 'active' as UserStatus,
    phone: '',
    department: 'Clinical Research',
    twoFactorEnabled: false
  });

  const allRoles: Role[] = [
    'System Admin',
    'Organization Admin',
    'Researcher',
    'Doctor',
    'Data Analyst',
    'Viewer'
  ];

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesOrg = orgFilter === 'all' || u.organizationId === orgFilter;
    return matchesSearch && matchesRole && matchesOrg;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const org = organizations.find((o) => o.id === formData.organizationId) || organizations[0];

    addUser({
      name: formData.name,
      email: formData.email,
      organizationId: org.id,
      organizationName: org.name,
      role: formData.role,
      status: formData.status,
      phone: formData.phone || '+91 90000 00000',
      department: formData.department || 'Medical Oncology',
      twoFactorEnabled: formData.twoFactorEnabled
    });

    setIsAddModalOpen(false);
    setFormData({
      name: '',
      email: '',
      organizationId: organizations[0]?.id || 'org-apollo',
      role: 'Doctor',
      status: 'active',
      phone: '',
      department: 'Clinical Research',
      twoFactorEnabled: false
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const org = organizations.find((o) => o.id === editingUser.organizationId);
    updateUser(editingUser.id, {
      ...editingUser,
      organizationName: org?.name || editingUser.organizationName
    });
    setEditingUser(null);
  };

  const confirmDelete = () => {
    if (deletingUserId) {
      deleteUser(deletingUserId);
      if (drawerUser?.id === deletingUserId) setDrawerUser(null);
      setDeletingUserId(null);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'System Admin':
        return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60';
      case 'Organization Admin':
        return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60';
      case 'Researcher':
        return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60';
      case 'Doctor':
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60';
      case 'Data Analyst':
        return 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60';
      default:
        return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel & Role Governance"
        subtitle="Manage verified clinicians, researchers, and data engineers with fine-grained RBAC permissions and hardware 2FA."
        breadcrumbs={['Federation', 'Users']}
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>
        }
      />

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Registered Personnel</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {users.length} Total
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">Active Enclave Access</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Clinicians</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {users.filter((u) => u.status === 'active').length}
          </p>
          <span className="text-[11px] text-slate-400">Zero Security Blocks</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Hardware 2FA</span>
            <Lock className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {users.filter((u) => u.twoFactorEnabled).length}
          </p>
          <span className="text-[11px] text-purple-600 font-medium font-mono">TOTP enrollment</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">RBAC Roles</span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            6 Levels
          </p>
          <span className="text-[11px] text-slate-400">Audited by Compliance</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, department..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Roles (System Admin, Doctor, Researcher...)</option>
            {allRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white"
          >
            <option value="all">All Healthcare Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Role Badge</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto stroke-[1.5] mb-2 opacity-50" />
                    <p>No verified users match this query.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => setDrawerUser(user)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                          {user.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors block">
                            {user.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[180px]">
                        {user.organizationName}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                        {user.department}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-xs">
                        {user.status === 'active' && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
                          </>
                        )}
                        {user.status === 'inactive' && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Inactive</span>
                          </>
                        )}
                        {user.status === 'suspended' && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-red-700 dark:text-red-400 font-medium">Suspended</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {user.lastLogin}
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDrawerUser(user)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                          title="Open Details Drawer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`p-1.5 rounded transition-colors ${
                            user.status === 'active'
                              ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                          title={user.status === 'active' ? 'Suspend User' : 'Activate User'}
                        >
                          {user.status === 'active' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeletingUserId(user.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Slide-Out Drawer */}
      {drawerUser && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          onClick={() => setDrawerUser(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  User Details & Access Scope
                </h3>
              </div>
              <button
                onClick={() => setDrawerUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs flex-1">
              {/* Profile Card */}
              <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-md">
                  {drawerUser.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-3">
                  {drawerUser.name}
                </h4>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadge(drawerUser.role)}`}>
                    {drawerUser.role}
                  </span>
                  {drawerUser.twoFactorEnabled && (
                    <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      <Lock className="w-3 h-3" />
                      <span>2FA</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Information */}
              <div className="space-y-3">
                <h5 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Enclave & Institutional Details</span>
                </h5>
                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Organization:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{drawerUser.organizationName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Department:</span>
                    <span className="text-slate-800 dark:text-slate-200">{drawerUser.department}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Email:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{drawerUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Phone:</span>
                    <span className="text-slate-800 dark:text-slate-200">{drawerUser.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Login:</span>
                    <span className="font-mono">{drawerUser.lastLogin}</span>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-3">
                <h5 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-purple-600" />
                  <span>Cryptographic Entitlements</span>
                </h5>
                <div className="space-y-1.5">
                  {drawerUser.permissions.map((p) => (
                    <div
                      key={p}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions in drawer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    toggleUserStatus(drawerUser.id);
                    setDrawerUser({
                      ...drawerUser,
                      status: drawerUser.status === 'active' ? 'suspended' : 'active'
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    drawerUser.status === 'active'
                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  {drawerUser.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                </button>

                <button
                  onClick={() => {
                    setSelectedUserId(drawerUser.id);
                    setActiveTab('user-profile');
                    setDrawerUser(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Full Profile View →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Federated User
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dr. Kavita Raman"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enterprise Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="kavita.raman@apollohospitals.demo"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Healthcare Organization
                  </label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Federation Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {allRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Precision Genomics"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98400 12345"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <p className="text-xs text-slate-500">Members enroll in TOTP from their own Settings before two-factor sign-in can be enabled.</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit User: {editingUser.name}
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as Role })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {allRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as UserStatus })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold">Revoke User Credentials</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently revoke access for this user? Their cryptographic tokens and session cookies will be invalidated immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingUserId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
