import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { ShareData } from '@/api/types';
import PageviewsChart from '@/components/charts/PageviewsChart';
import DeviceChart from '@/components/charts/DeviceChart';

function getShareToken(): string {
  const parts = window.location.pathname.split('/');
  return parts[parts.indexOf('share') + 1] ?? '';
}

type Days = 7 | 30 | 90;

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(code: string): string {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

export default function Share() {
  const token = getShareToken();
  const [days, setDays] = useState<Days>(7);
  const [password, setPassword] = useState('');
  const [submittedPw, setSubmittedPw] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token, days, submittedPw],
    queryFn: async () => {
      try {
        return await api.get<ShareData>(
          `/api/share/${token}?days=${days}${submittedPw ? `&pw=${encodeURIComponent(submittedPw)}` : ''}`,
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setNeedsPassword(true);
        }
        throw err;
      }
    },
    enabled: !!token,
    retry: false,
  });

  if (needsPassword && !submittedPw) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">This report is protected</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedPw(password);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              className="input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full justify-center">
              View report
            </button>
          </form>
          {error instanceof ApiError && error.status === 401 && submittedPw && (
            <p className="mt-2 text-sm text-red-600">Incorrect password</p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Report not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-brand-600">EdgeIQ</span>
          <span className="ml-3 text-sm text-gray-500">{data.site.name || data.site.domain}</span>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([7, 30, 90] as Days[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-gray-500">Pageviews</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data.totals.pageviews.toLocaleString()}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">Top page</p>
            <p className="text-sm font-mono font-medium text-gray-900 truncate">
              {data.top_pages[0]?.path ?? '—'}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-gray-500">Top country</p>
            <p className="text-sm font-medium text-gray-900">
              {data.countries[0] ? countryName(data.countries[0].country) : '—'}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pageviews over time</h3>
          <PageviewsChart data={data.timeseries} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-6 stat-card">
            <SimpleTable
              title="Top pages"
              rows={data.top_pages.map((r) => ({ key: r.path, val: r.views }))}
              total={data.totals.pageviews}
            />
            <SimpleTable
              title="Top referrers"
              rows={data.top_referrers.map((r) => ({ key: r.referrer || '(direct)', val: r.visits }))}
              total={data.totals.pageviews}
            />
            <SimpleTable
              title="Countries"
              rows={data.countries.map((r) => ({
                key: countryName(r.country) || r.country,
                val: r.visits,
              }))}
              total={data.totals.pageviews}
            />
          </div>
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Devices</h3>
            <DeviceChart data={data.devices} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Powered by <span className="text-brand-500 font-medium">EdgeIQ</span> — privacy-first analytics
        </p>
      </main>
    </div>
  );
}

function SimpleTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ key: string; val: number }>;
  total: number;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No data</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const pct = total > 0 ? (row.val / total) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="truncate text-gray-700 font-mono">{row.key}</span>
                    <span className="ml-2 text-gray-500">{row.val.toLocaleString()}</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100">
                    <div
                      className="h-1 rounded-full bg-brand-400"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
