import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Shell from '@/components/layout/Shell';
import Overview from '@/pages/Overview';
import Sites from '@/pages/Sites';
import Settings from '@/pages/Settings';
import { api } from '@/api/client';
import type { User, Site } from '@/api/types';

type Tab = 'overview' | 'sites' | 'settings';

type Props = {
  user: User;
  onLogout: () => void;
};

export default function Dashboard({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ sites: Site[] }>('/api/sites'),
  });

  const sites = data?.sites ?? [];

  return (
    <Shell user={user} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'overview' && <Overview sites={sites} />}
          {tab === 'sites' && <Sites sites={sites} />}
          {tab === 'settings' && <Settings user={user} />}
        </>
      )}
    </Shell>
  );
}
