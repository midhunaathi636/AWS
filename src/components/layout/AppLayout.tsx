import React from 'react';
import { useApp } from '../../context/AppContext';
import { TopNavbar } from './TopNavbar';
import { Sidebar } from './Sidebar';
import { NotificationDrawer } from './NotificationDrawer';
import { GlobalSearchModal } from './GlobalSearchModal';
import { ToastContainer } from '../common/ToastContainer';

import { LoginView } from '../../views/LoginView';
import { DashboardView } from '../../views/DashboardView';
import { OrganizationsView } from '../../views/OrganizationsView';
import { OrganizationDetailsView } from '../../views/OrganizationDetailsView';
import { UsersView } from '../../views/UsersView';
import { UserProfileView } from '../../views/UserProfileView';
import { SecureDataView } from '../../views/SecureDataView';
import { DataSharingView } from '../../views/DataSharingView';
import { FederatedLearningView } from '../../views/FederatedLearningView';
import { GlobalModelView } from '../../views/GlobalModelView';
import { AuditLogsView } from '../../views/AuditLogsView';
import { ReportsView } from '../../views/ReportsView';
import { SettingsView } from '../../views/SettingsView';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, activeTab } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <ToastContainer />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'organizations':
        return <OrganizationsView />;
      case 'organization-details':
        return <OrganizationDetailsView />;
      case 'users':
        return <UsersView />;
      case 'user-profile':
        return <UserProfileView />;
      case 'secure-data':
        return <SecureDataView />;
      case 'data-sharing':
        return <DataSharingView />;
      case 'federated-learning':
        return <FederatedLearningView />;
      case 'global-model':
        return <GlobalModelView />;
      case 'audit-logs':
        return <AuditLogsView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <TopNavbar />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex w-full">
        {/* Sticky Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Slide-over drawers, modals and toasts */}
      <NotificationDrawer />
      <GlobalSearchModal />
      <ToastContainer />
    </div>
  );
};
