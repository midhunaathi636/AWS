import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  UserCheck,
  LogOut,
  Layers,
  Menu
} from 'lucide-react';

export const TopNavbar: React.FC = () => {
  const {
    currentUser,
    switchUser,
    users,
    organizations,
    activeOrgFilter,
    setActiveOrgFilter,
    isDarkMode,
    toggleDarkMode,
    toggleSidebar,
    isSidebarCollapsed,
    setIsNotificationDrawerOpen,
    notifications,
    setIsSearchModalOpen,
    logout,
    setActiveTab
  } = useApp();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOrgName =
    activeOrgFilter === 'all'
      ? 'All Organizations'
      : organizations.find((o) => o.id === activeOrgFilter)?.name || 'All Organizations';

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left Zone: Hamburger + Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white block leading-none">
                Secure Collaborative Learning Platform
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-none">
                Federated Privacy & Multi-Center Cloud
              </span>
            </div>
          </button>
        </div>

        {/* Center Zone: Global Search & Organization Switcher */}
        <div className="flex items-center gap-3 flex-1 max-w-xl mx-2">
          {/* Global Search Button */}
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center justify-between w-full max-w-sm px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">Search datasets, orgs, models, logs...</span>
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Current Organization Dropdown */}
          <div className="relative shrink-0 hidden lg:block" ref={orgRef}>
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="max-w-[140px] truncate">{activeOrgName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isOrgDropdownOpen && (
              <div className="absolute left-0 mt-1 w-64 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  Filter Network View
                </div>
                <button
                  onClick={() => {
                    setActiveOrgFilter('all');
                    setIsOrgDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    activeOrgFilter === 'all'
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    All Organizations (3)
                  </span>
                  {activeOrgFilter === 'all' && <span className="text-[10px]">Active</span>}
                </button>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setActiveOrgFilter(org.id);
                      setIsOrgDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      activeOrgFilter === org.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{org.name}</span>
                    </span>
                    {activeOrgFilter === org.id && <span className="text-[10px]">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Zone: Controls, Notifications & User Persona */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Dark / Light Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => setIsNotificationDrawerOpen(true)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="System Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* User Persona & Role Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700">
                {currentUser.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .substring(0, 2)}
              </div>
              <div className="hidden md:block">
                <span className="text-xs font-semibold text-slate-900 dark:text-white block leading-tight truncate max-w-[130px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block leading-tight font-medium">
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-1.5 w-72 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* User Info Header */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentUser.organizationName}
                    </span>
                    <span>·</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      {currentUser.role}
                    </span>
                  </div>
                </div>

                {/* Quick Persona Switcher for Evaluation */}
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Switch Persona (Demo)
                </div>
                {users.slice(0, 5).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      switchUser(user);
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                      currentUser.id === user.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-[11px] text-slate-400 block truncate">
                        {user.role} · {user.organizationName.split(' ')[0]}
                      </span>
                    </div>
                    {currentUser.id === user.id && (
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                  </button>
                ))}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  onClick={() => {
                    setActiveTab('user-profile');
                    setIsProfileOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Manage Profile & Security
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
