import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AnalyticsOverview, Site } from '@/api/types';
import PageviewsChart from '@/components/charts/PageviewsChart';
import DeviceChart from '@/components/charts/DeviceChart';
import { TrendingUp, FileText, Globe, Smartphone } from 'lucide-react';

type Days = 7 | 30 | 90;

type Props = {
  sites: Site[];
};

const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string): string {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

export default function Overview({ sites }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(sites[0]?.id ?? '');
  const [days, setDays] = useState<Days>(7);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', selectedSiteId, days],
    queryFn: () =>
      api.get<AnalyticsOverview>(`/api/analytics/${selectedSiteId}/overview?days=${days}`),
    enabled: !!selectedSiteId,
  });

  if (sites.length === 0) {
    return (
      <div className="text-center py-16">
        <Globe size={40} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-700">No sites yet</h3>
        <p className="mt-1 text-gray-400 text-sm">Add your first site to start seeing analytics.</p>
      </div>
    );
  }

  const o = data;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input w-auto"
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(e.target.value)}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.domain}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([7, 30, 90] as Days[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Pageviews"
              value={(o?.totals.pageviews ?? 0).toLocaleString()}
              Icon={TrendingUp}
            />
            <StatCard
              label="Unique pages"
              value={(o?.totals.unique_paths ?? 0).toLocaleString()}
              Icon={FileText}
            />
            <StatCard
              label="Countries"
              value={(o?.countries.length ?? 0).toLocaleString()}
              Icon={Globe}
            />
            <StatCard
              label="Referrers"
              value={(o?.top_referrers.length ?? 0).toLocaleString()}
              Icon={Smartphone}
            />
          </div>

          {/* Pageviews chart */}
          <div className="stat-card">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Pageviews over time</h3>
            <PageviewsChart data={o?.timeseries ?? []} />
          </div>

          {/* Tables + device chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="stat-card lg:col-span-2 space-y-6">
              <DataTable
                title="Top pages"
                rows={o?.top_pages ?? []}
                keyCol="path"
                valCol="views"
                valLabel="Views"
                total={o?.totals.pageviews ?? 0}
              />
              <DataTable
                title="Top referrers"
                rows={(o?.top_referrers ?? []).map((r) => ({
                  path: r.referrer || '(direct)',
                  views: r.visits,
                }))}
                keyCol="path"
                valCol="views"
                valLabel="Visits"
                total={o?.totals.pageviews ?? 0}
              />
              <DataTable
                title="Countries"
                rows={(o?.countries ?? []).map((r) => ({
                  path: countryName(r.country) || r.country || '(unknown)',
                  views: r.visits,
                }))}
                keyCol="path"
                valCol="views"
                valLabel="Visits"
                total={o?.totals.pageviews ?? 0}
              />
            </div>
            <div className="stat-card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Devices</h3>
              <DeviceChart data={o?.devices ?? []} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="stat-card flex items-start gap-3">
      <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DataTable({
  title,
  rows,
  keyCol,
  valCol,
  valLabel,
  total,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  keyCol: string;
  valCol: string;
  valLabel: string;
  total: number;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const key = String(row[keyCol] ?? '');
            const val = Number(row[valCol] ?? 0);
            const pct = total > 0 ? (val / total) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate text-gray-700 font-mono">{key}</span>
                    <span className="ml-2 shrink-0 text-gray-500">
                      {val.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100">
                    <div
                      className="h-1 rounded-full bg-brand-400"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
