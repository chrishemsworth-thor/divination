import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { Site } from '@/api/types';
import { Plus, CheckCircle, Clock, AlertCircle, Share2, Trash2, Settings } from 'lucide-react';

type Props = {
  sites: Site[];
};

const PLATFORMS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'squarespace', label: 'Squarespace' },
  { value: 'wix', label: 'Wix' },
  { value: 'framer', label: 'Framer' },
  { value: 'custom', label: 'Custom / Other' },
];

function StatusBadge({ status }: { status: Site['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle size={10} /> Active
      </span>
    );
  if (status === 'pending')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
        <Clock size={10} /> Pending setup
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <AlertCircle size={10} /> Inactive
    </span>
  );
}

function SetupInstructions({ site }: { site: Site }) {
  const workerUrl = `${site.cname_slug}.edgeiq.workers.dev`;

  if (site.tracking_method === 'pixel') {
    const pixelSrc = `https://analytics.${site.domain}/pixel.gif?path=PAGE_PATH&ref=REFERRER`;

    const instructions: Record<string, React.ReactNode> = {
      wordpress: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
          <li>
            In your DNS dashboard, add a CNAME record:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              analytics.{site.domain} → {workerUrl}
            </code>
          </li>
          <li>
            Install <strong>Insert Headers and Footers</strong> plugin, then add this to the footer:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
              {`<img src="https://analytics.${site.domain}/pixel.gif?path=%%REQUEST_URI%%" width="1" height="1" />`}
            </code>
          </li>
        </ol>
      ),
      shopify: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
          <li>
            Add CNAME in your DNS (Shopify uses Cloudflare or your domain registrar):
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              analytics.{site.domain} → {workerUrl}
            </code>
          </li>
          <li>
            In Shopify Admin → Online Store → Themes → Edit code → <code>theme.liquid</code>,
            add before <code>{'</body>'}</code>:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
              {`<img src="https://analytics.${site.domain}/pixel.gif?path={{ request.path | url_encode }}" width="1" height="1" />`}
            </code>
          </li>
        </ol>
      ),
      webflow: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
          <li>
            Add CNAME in Webflow Hosting → DNS:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              analytics.{site.domain} → {workerUrl}
            </code>
          </li>
          <li>
            In Webflow → Site Settings → Custom Code → Footer, add:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
              {`<img src="https://analytics.${site.domain}/pixel.gif?path=" id="eq-px" width="1" height="1" />`}
              {`<script>document.getElementById('eq-px').src+= encodeURIComponent(location.pathname);</script>`}
            </code>
          </li>
        </ol>
      ),
      default: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
          <li>
            Add a CNAME DNS record:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
              analytics.{site.domain} → {workerUrl}
            </code>
          </li>
          <li>
            Add this tag before <code>{'</body>'}</code> on every page:
            <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
              {`<img src="https://analytics.${site.domain}/pixel.gif?path=YOUR_PATH" width="1" height="1" />`}
            </code>
          </li>
        </ol>
      ),
    };

    return (
      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Setup instructions</h4>
        {instructions[site.platform] ?? instructions['default']}
      </div>
    );
  }

  // JS snippet method
  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">Setup instructions (JS snippet)</h4>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
        <li>
          Add before <code>{'</body>'}</code>:
          <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
            {`<script src="https://${workerUrl}/edgeiq.js" async></script>`}
          </code>
        </li>
        <li>No DNS changes needed — requests go directly to the EdgeIQ Worker.</li>
      </ol>
    </div>
  );
}

function SiteCard({ site, onDelete }: { site: Site; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState(site.share_token);
  const qc = useQueryClient();

  const deleteSite = useMutation({
    mutationFn: () => api.delete(`/api/sites/${site.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      onDelete(site.id);
    },
  });

  const toggleShare = useMutation({
    mutationFn: () =>
      api.post<{ share_token: string | null }>(`/api/sites/${site.id}/share`, {
        revoke: !!shareToken,
      }),
    onSuccess: (data) => {
      setShareToken(data.share_token);
    },
  });

  const platformLabel = PLATFORMS.find((p) => p.value === site.platform)?.label ?? site.platform;
  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{site.name || site.domain}</h3>
            <StatusBadge status={site.status} />
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {platformLabel}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{site.domain}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Setup instructions"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => toggleShare.mutate()}
            className={`p-1.5 rounded-lg transition-colors ${
              shareToken
                ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={shareToken ? 'Revoke share link' : 'Generate share link'}
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${site.domain}? This removes all data permanently.`)) {
                deleteSite.mutate();
              }
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="mt-3 flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-2">
          <span className="text-xs text-brand-700 font-mono truncate flex-1">{shareUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium shrink-0"
          >
            Copy
          </button>
        </div>
      )}

      {expanded && <SetupInstructions site={site} />}
    </div>
  );
}

export default function Sites({ sites }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState<'pixel' | 'js'>('pixel');
  const [platform, setPlatform] = useState('custom');
  const [error, setError] = useState('');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const addSite = useMutation({
    mutationFn: () =>
      api.post<{ site: Site }>('/api/sites', {
        domain,
        name,
        tracking_method: method,
        platform,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      setShowAdd(false);
      setDomain('');
      setName('');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to add site');
    },
  });

  const visibleSites = sites.filter((s) => !deletedIds.has(s.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Your sites</h2>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} />
          Add site
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Add a new site</h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              addSite.mutate();
            }}
          >
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <div>
              <label className="label">Domain</label>
              <input
                className="input"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Display name (optional)</label>
              <input
                className="input"
                placeholder="My Client Site"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Platform</label>
              <select
                className="input"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tracking method</label>
              <div className="flex gap-3">
                {(['pixel', 'js'] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                      method === m
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={m}
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="sr-only"
                    />
                    {m === 'pixel' ? 'CNAME pixel (recommended)' : 'JS snippet'}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {method === 'pixel'
                  ? 'A 1×1 pixel image served from your own subdomain — no JS, ad-blocker proof.'
                  : 'Optional 2KB script for scroll depth, outbound clicks, and richer session data.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={addSite.isPending}>
                {addSite.isPending ? 'Adding…' : 'Add site'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {visibleSites.length === 0 && !showAdd && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">No sites added yet.</p>
        </div>
      )}

      {visibleSites.map((site) => (
        <SiteCard
          key={site.id}
          site={site}
          onDelete={(id) => setDeletedIds((prev) => new Set([...prev, id]))}
        />
      ))}
    </div>
  );
}
