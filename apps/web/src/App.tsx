import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { User } from '@/api/types';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Share from '@/pages/Share';

type View = 'login' | 'register' | 'dashboard' | 'share';

function getInitialView(): View {
  const path = window.location.pathname;
  if (path.startsWith('/share/')) return 'share';
  return 'login';
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView);

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: User | null }>('/api/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;
    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      setView('share');
      return;
    }
    if (data?.user) {
      setView('dashboard');
    } else if (view !== 'register') {
      setView('login');
    }
  }, [data, isLoading]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname;
      if (path.startsWith('/share/')) setView('share');
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  if (isLoading && view !== 'share') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (view === 'share') {
    return <Share />;
  }

  if (view === 'login') {
    return (
      <Login
        onSuccess={() => setView('dashboard')}
        onRegister={() => setView('register')}
      />
    );
  }

  if (view === 'register') {
    return (
      <Register
        onSuccess={() => setView('dashboard')}
        onLogin={() => setView('login')}
      />
    );
  }

  return (
    <Dashboard
      user={data!.user!}
      onLogout={() => setView('login')}
    />
  );
}
