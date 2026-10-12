import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/common/PageHeader';
import { api } from '../services/api';
import { AwsOperationsPanel } from '../components/common/AwsOperationsPanel';
import {
  Settings,
  Shield,
  BrainCircuit,
  Bell,
  User,
  Sliders,
  Sun,
  Moon,
  Key,
  Lock,
  Building2,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Smartphone
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    currentUser,
    updateUser,
    isDarkMode,
    toggleDarkMode,
    addToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'general' | 'security' | 'organizations' | 'federated' | 'notifications' | 'profile' | 'appearance'
  >('profile');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
    role: currentUser.role,
    organizationName: currentUser.organizationName
  });

  // Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Settings local state
  const [flForm, setFlForm] = useState(settings.federatedLearning);
  const [secForm, setSecForm] = useState(settings.security);
  const [genForm, setGenForm] = useState(settings.general);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUrl, setTotpUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const beginTotpSetup = async () => {
    try {
      const setup = await api.startTotpSetup();
      setTotpSecret(setup.secret);
      setTotpUrl(setup.otpauthUrl);
    } catch (error) {
      addToast({ type: 'error', title: '2FA Setup Failed', message: error instanceof Error ? error.message : 'Could not start authenticator setup.' });
    }
  };

  const confirmTotpSetup = async () => {
    try {
      await api.confirmTotpSetup(totpCode);
      updateUser(currentUser.id, { twoFactorEnabled: true });
      setTotpSecret(''); setTotpUrl(''); setTotpCode('');
      addToast({ type: 'success', title: 'Two-Factor Enabled', message: 'Authenticator codes will be required at the next sign-in.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Code Not Accepted', message: error instanceof Error ? error.message : 'Could not verify authenticator code.' });
    }
  };

  const disableTotp = async () => {
    try {
      await api.disableTotp(disablePassword, disableCode);
      updateUser(currentUser.id, { twoFactorEnabled: false });
      setDisablePassword(''); setDisableCode('');
      addToast({ type: 'success', title: 'Two-Factor Disabled', message: 'Authenticator verification was removed from sign-in.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Could Not Disable 2FA', message: error instanceof Error ? error.message : 'Check your password and authenticator code.' });
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(currentUser.id, {
      name: profileForm.name,
      email: profileForm.email,
      phone: profileForm.phone
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirmation do not match.'
      });
      return;
    }
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      addToast({ type: 'success', title: 'Password Updated', message: 'Your password changed and other sessions were signed out.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Password Change Failed', message: error instanceof Error ? error.message : 'Could not change password.' });
    }
  };

  const handleSaveSystemSettings = () => {
    updateSettings({
      general: genForm,
      security: secForm,
      federatedLearning: flForm
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Federation Governance & Preferences"
        subtitle="Manage personal access credentials, hardware MFA, federated aggregation parameters, and system security thresholds."
        breadcrumbs={['Federation', 'Settings', activeTab]}
        actions={
          <button
            onClick={handleSaveSystemSettings}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save All Configurations</span>
          </button>
        }
      />

      {/* Settings Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile & Persona</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'security'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security Preferences</span>
        </button>

        <button
          onClick={() => setActiveTab('federated')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'federated'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>Federated Learning Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'general'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>General Federation</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'notifications'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            activeTab === 'appearance'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Appearance</span>
        </button>
      </div>

      {/* Tab 1: Profile & Persona Settings */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
              {currentUser.name.split(' ').map((p) => p[0]).join('').substring(0, 2)}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {currentUser.name}
              </h2>
              <p className="text-xs text-slate-500">
                {currentUser.role} · {currentUser.organizationName}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Certificate Verified</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enterprise Work Email
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Federation Role (Assigned)
                </label>
                <input
                  type="text"
                  disabled
                  value={profileForm.role}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* 2FA Toggle & Password */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      Authenticator App Two-Factor Authentication (TOTP)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Requires a time-based authenticator code at sign-in
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${currentUser.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>{currentUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              {!currentUser.twoFactorEnabled && !totpSecret && <button type="button" onClick={beginTotpSetup} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">Set up authenticator app</button>}
              {totpSecret && <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">Add this account in an authenticator app using the setup key or URI. The key expires in 10 minutes.</p>
                <code className="block text-xs select-all break-all">{totpSecret}</code>
                <a href={totpUrl} className="text-xs text-blue-600 underline">Open authenticator setup link</a>
                <div className="flex gap-2"><input value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="px-3 py-2 text-xs rounded border dark:bg-slate-900 dark:border-slate-700" /><button type="button" onClick={confirmTotpSetup} disabled={totpCode.length !== 6} className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50 text-white text-xs">Verify and enable</button></div>
              </div>}
              {currentUser.twoFactorEnabled && <div className="flex flex-wrap gap-2"><input type="password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} placeholder="Current password" className="px-3 py-2 text-xs rounded border dark:bg-slate-900 dark:border-slate-700" /><input value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="px-3 py-2 text-xs rounded border dark:bg-slate-900 dark:border-slate-700" /><button type="button" onClick={disableTotp} disabled={!disablePassword || disableCode.length !== 6} className="px-3 py-2 rounded border border-rose-300 text-rose-700 disabled:opacity-50 text-xs">Disable 2FA</button></div>}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Save Profile Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Zero-Trust Settings */}
      {activeTab === 'security' && (
        <>
        <AwsOperationsPanel />
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Security Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure local security preferences. Cryptographic proofs and regulatory retention controls are not implemented.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Require MFA for new federation participants
                </span>
                <span className="text-[11px] text-slate-500 block">
                  This setting is a policy preference only; account sign-in currently enforces TOTP only for users who enroll it in Profile Settings.
                </span>
              </div>
              <input
                type="checkbox"
                checked={secForm.enforceMfa}
                onChange={(e) => setSecForm({ ...secForm, enforceMfa: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Request future proof-based consensus checks
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Preference only; this release does not generate or verify proofs.
                </span>
              </div>
              <input
                type="checkbox"
                checked={secForm.requireZeroKnowledgeProofs}
                onChange={(e) => setSecForm({ ...secForm, requireZeroKnowledgeProofs: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enclave Cipher Suite
                </label>
                <input
                  type="text"
                  disabled
                  value={secForm.encryptionStandard}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono text-slate-600 dark:text-slate-300 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Log Immutable Retention (Days)
                </label>
                <input
                  type="number"
                  value={secForm.logRetentionDays}
                  onChange={(e) => setSecForm({ ...secForm, logRetentionDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Tab 3: Federated Learning Engine */}
      {activeTab === 'federated' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Federated Averaging & Differential Privacy Engine
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tune mathematical convergence parameters, gradient clipping norms, and client quorum thresholds
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Aggregation Algorithm
              </label>
              <select
                value={flForm.defaultAlgorithm}
                onChange={(e) => setFlForm({ ...flForm, defaultAlgorithm: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="FedAvg">FedAvg (McMahan et al. Federated Averaging)</option>
                <option value="FedProx">FedProx (Heterogeneous Systems Regularization)</option>
                <option value="FedAdam">FedAdam (Adaptive Server-Side Optimization)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Differential Privacy Epsilon (ε Budget)
              </label>
              <input
                type="number"
                step="0.1"
                value={flForm.dpEpsilon}
                onChange={(e) => setFlForm({ ...flForm, dpEpsilon: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gradient Clipping Norm (L2-norm C)
              </label>
              <input
                type="number"
                step="0.1"
                value={flForm.clippingNorm}
                onChange={(e) => setFlForm({ ...flForm, clippingNorm: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Minimum Client Quorum for Aggregation
              </label>
              <input
                type="number"
                value={flForm.minClientsRequired}
                onChange={(e) => setFlForm({ ...flForm, minClientsRequired: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General Settings */}
      {activeTab === 'general' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Platform General Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consortium deployment metadata, timezone configuration, and security session duration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Platform Brand Name
              </label>
              <input
                type="text"
                value={genForm.platformName}
                onChange={(e) => setGenForm({ ...genForm, platformName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Security Enclave Support Email
              </label>
              <input
                type="email"
                value={genForm.contactSupportEmail}
                onChange={(e) => setGenForm({ ...genForm, contactSupportEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Standard Timezone
              </label>
              <input
                type="text"
                value={genForm.timezone}
                onChange={(e) => setGenForm({ ...genForm, timezone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Inactivity Session Timeout (Minutes)
              </label>
              <input
                type="number"
                value={genForm.sessionTimeoutMins}
                onChange={(e) => setGenForm({ ...genForm, sessionTimeoutMins: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Notifications */}
      {activeTab === 'notifications' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Notification Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure priority alerting thresholds for federated training events and access expirations
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { title: 'Training Round Convergence Alert', desc: 'Notify immediately when all client gradient vectors merge.' },
              { title: 'Data Sharing Token Expiration Warning', desc: 'Warn 14 days prior to cross-institutional grant expiry.' },
              { title: 'Future Privacy Budget Alerts', desc: 'Preference only; privacy accounting and epsilon alerts are not implemented.' },
              { title: 'Security Enclave Violation Block', desc: 'High-priority dispatch if unauthorized binary retrieval attempted.' }
            ].map((n, i) => (
              <div
                key={i}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">{n.title}</span>
                  <span className="text-[11px] text-slate-500 block">{n.desc}</span>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Appearance */}
      {activeTab === 'appearance' && (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 text-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Interface Theme & Density
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize dashboard visual mode for laboratory or operating room terminals
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => isDarkMode && toggleDarkMode()}
              className={`p-4 rounded-xl border text-left transition-all ${
                !isDarkMode
                  ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-600'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Sun className="w-6 h-6 text-amber-500 mb-2" />
              <span className="font-bold text-slate-900 dark:text-white block">Light Theme</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Clean academic clinical mode (#F8FAFC)
              </span>
            </button>

            <button
              onClick={() => !isDarkMode && toggleDarkMode()}
              className={`p-4 rounded-xl border text-left transition-all ${
                isDarkMode
                  ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-600'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Moon className="w-6 h-6 text-blue-400 mb-2" />
              <span className="font-bold text-slate-900 dark:text-white block">Dark Navy Theme</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Low-light radiology & command center console (#0F172A)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Rotate Access Passphrase
            </h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Secure Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg"
                >
                  Update Passphrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
