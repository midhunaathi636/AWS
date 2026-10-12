import React, { useState } from 'react';
import { useApp, TabId } from '../../context/AppContext';
import { X, CheckCheck, Trash2, Bell, Shield, Database, BrainCircuit, Users } from 'lucide-react';

export const NotificationDrawer: React.FC = () => {
  const {
    isNotificationDrawerOpen,
    setIsNotificationDrawerOpen,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    setActiveTab
  } = useApp();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isNotificationDrawerOpen) return null;

  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.read : true
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <BrainCircuit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'file':
        return <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'security':
        return <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'user':
      case 'organization':
        return <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const handleNotificationClick = (item: (typeof notifications)[0]) => {
    markNotificationAsRead(item.id);
    if (item.linkTab) {
      setActiveTab(item.linkTab as TabId);
      setIsNotificationDrawerOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div
        className="w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {notifications.filter((n) => !n.read).length} new
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={markAllNotificationsAsRead}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              onClick={clearNotifications}
              className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsNotificationDrawerOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Activity ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Unread Only ({notifications.filter((n) => !n.read).length})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto stroke-[1.5] mb-2 opacity-50" />
              <p className="text-xs">No notifications found.</p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-start gap-3 ${
                  item.read
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75'
                    : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                }`}
              >
                <div className="shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mt-0.5">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold truncate ${item.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {item.message}
                  </p>
                  {item.linkTab && (
                    <span className="inline-block mt-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      View details →
                    </span>
                  )}
                </div>
                {!item.read && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
