import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart2, Globe, Settings, LogOut, Menu, X } from 'lucide-react';
import { api } from '@/api/client';
import type { User } from '@/api/types';

type Tab = 'overview' | 'sites' | 'settings';

type Props = {
  user: User;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

const NAV = [
  { id: 'overview' as Tab, label: 'Overview', Icon: BarChart2 },
  { id: 'sites' as Tab, label: 'Sites', Icon: Globe },
  { id: 'settings' as Tab, label: 'Settings', Icon: Settings },
];

export default function Shell({ user, activeTab, onTabChange, onLogout, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const qc = useQueryClient();

  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.clear();
      onLogout();
    },
  });

  const nav = (
    <nav className="flex flex-col gap-1 p-4">
      {NAV.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => {
            onTabChange(id);
            setMobileOpen(false);
          }}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === id
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-gray-200 bg-white fixed inset-y-0 left-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-brand-600">EdgeIQ</span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
        <span className="text-lg font-bold text-brand-600">EdgeIQ</span>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-10 bg-white pt-14">
          {nav}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => {
                logout.mutate();
                setMobileOpen(false);
              }}
              className="flex items-center gap-2 text-sm text-gray-500"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
