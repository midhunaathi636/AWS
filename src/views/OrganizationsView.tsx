import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { Organization, OrgType } from '../types';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  MapPin,
  Mail,
  Shield,
  CheckCircle2,
  X,
  AlertTriangle,
  HardDrive,
  Users
} from 'lucide-react';

export const OrganizationsView: React.FC = () => {
  const {
    organizations,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    setSelectedOrgId,
    setActiveTab
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

  // Add form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'Hospital Network' as OrgType,
    location: '',
    adminName: '',
    adminEmail: '',
    contactPhone: '',
    maxStorageGb: 1000,
    description: '',
    status: 'active' as const
  });

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.adminName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.adminEmail) return;

    addOrganization({
      name: formData.name,
      type: formData.type,
      location: formData.location || 'India',
      adminName: formData.adminName || 'Admin Lead',
      adminEmail: formData.adminEmail,
      contactPhone: formData.contactPhone || '+91 80 0000 0000',
      maxStorageGb: Number(formData.maxStorageGb) || 1000,
      description: formData.description || 'Federated healthcare participant node.',
      status: formData.status
    });

    setIsAddModalOpen(false);
    setFormData({
      name: '',
      type: 'Hospital Network',
      location: '',
      adminName: '',
      adminEmail: '',
      contactPhone: '',
      maxStorageGb: 1000,
      description: '',
      status: 'active'
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    updateOrganization(editingOrg.id, editingOrg);
    setEditingOrg(null);
  };

  const confirmDelete = () => {
    if (deletingOrgId) {
      deleteOrganization(deletingOrgId);
      setDeletingOrgId(null);
    }
  };

  const handleViewDetails = (orgId: string) => {
    setSelectedOrgId(orgId);
    setActiveTab('organization-details');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Participating Organizations"
        subtitle="View participating organizations and their recorded activity."
        breadcrumbs={['Federation', 'Organizations']}
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Organization</span>
          </button>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Enclaves</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {organizations.length} Active
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">100% Attested</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Enclave Personnel</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {organizations.reduce((sum, o) => sum + o.usersCount, 0)} Members
          </p>
          <span className="text-[11px] text-slate-400">RBAC Enforced</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Storage Used</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {organizations.reduce((sum, o) => sum + o.storageUsedGb, 0)} GB
          </p>
          <span className="text-[11px] text-slate-400">of 4,548 GB Cap</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Consortium Accuracy</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 tabular-nums">
            {Math.round(organizations.reduce((sum, o) => sum + o.avgAccuracy, 0) / (organizations.length || 1))}%
          </p>
          <span className="text-[11px] text-blue-600 font-medium font-mono">Consensus Score</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by institution name, location, or admin..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Segmented filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg text-xs self-start sm:self-auto">
          {(['all', 'active', 'pending', 'suspended'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Organization Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4 text-right">Users</th>
                <th className="py-3 px-4">Storage Used</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto stroke-[1.5] mb-2 opacity-50" />
                    <p>No organizations match the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const storagePct = Math.round((org.storageUsedGb / org.maxStorageGb) * 100);

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleViewDetails(org.id)}
                          className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left block"
                        >
                          {org.name}
                        </button>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: {org.id}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {org.type}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{org.location}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {org.adminName}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {org.adminEmail}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right tabular-nums font-mono font-medium text-slate-700 dark:text-slate-300">
                        {org.usersCount}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 tabular-nums">
                            <span>{org.storageUsedGb} GB</span>
                            <span>{storagePct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${Math.min(storagePct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="flex items-center gap-1.5 text-xs">
                          {org.status === 'active' && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Active</span>
                            </>
                          )}
                          {org.status === 'pending' && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-amber-700 dark:text-amber-400 font-medium">Pending</span>
                            </>
                          )}
                          {org.status === 'suspended' && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-700 dark:text-red-400 font-medium">Suspended</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(org.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                            title="View Deep Dive Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingOrg(org)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="Edit Organization"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingOrgId(org.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                            title="Delete Organization"
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

      {/* Add Organization Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Healthcare / Research Organization
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
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. AIIMS Institute of Medical Sciences"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Institution Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as OrgType })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Hospital Network">Hospital Network</option>
                    <option value="Academic Medical Center">Academic Medical Center</option>
                    <option value="Biotech Research Lab">Biotech Research Lab</option>
                    <option value="Diagnostic Center">Diagnostic Center</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. New Delhi, IN"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Admin Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    placeholder="e.g. Dr. Sanjay Mehta"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Admin Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    placeholder="sanjay.mehta@aiims.demo"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Allocation (GB)
                  </label>
                  <input
                    type="number"
                    value={formData.maxStorageGb}
                    onChange={(e) => setFormData({ ...formData, maxStorageGb: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Enclave Hotline
                  </label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+91 11 2658 8500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enclave Description & Research Focus
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Primary therapeutic areas, patient demographics, and infrastructure details."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
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
                  Enroll Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Organization: {editingOrg.name}
              </h2>
              <button
                onClick={() => setEditingOrg(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editingOrg.location}
                    onChange={(e) => setEditingOrg({ ...editingOrg, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingOrg.status}
                    onChange={(e) => setEditingOrg({ ...editingOrg, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Admin Name
                  </label>
                  <input
                    type="text"
                    value={editingOrg.adminName}
                    onChange={(e) => setEditingOrg({ ...editingOrg, adminName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Cap (GB)
                  </label>
                  <input
                    type="number"
                    value={editingOrg.maxStorageGb}
                    onChange={(e) => setEditingOrg({ ...editingOrg, maxStorageGb: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
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
      {deletingOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Remove Organization</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to revoke this organization's federation membership? All active data shares and cryptographic weight exchange links will be terminated.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingOrgId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
