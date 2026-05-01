import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { BillingStatus, User } from '@/api/types';
import { ExternalLink } from 'lucide-react';

type Props = {
  user: User;
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    prices: { global: 29, my: 17, ph: 15 },
    sites: 3,
    description: 'For small agencies getting started',
  },
  {
    id: 'growth',
    name: 'Growth',
    prices: { global: 79, my: 47, ph: 42 },
    sites: 10,
    description: 'For growing agencies managing more clients',
  },
  {
    id: 'agency',
    name: 'Agency',
    prices: { global: 149, my: 89, ph: 79 },
    sites: Infinity,
    description: 'Unlimited sites for established agencies',
  },
] as const;

const CURRENCY: Record<string, string> = {
  global: 'USD',
  my: 'MYR',
  ph: 'PHP',
};

export default function Settings({ user }: Props) {
  const [region, setRegion] = useState<'global' | 'my' | 'ph'>('global');
  const [annual, setAnnual] = useState(false);
  const qc = useQueryClient();

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get<BillingStatus>('/api/billing/status'),
  });

  const checkout = useMutation({
    mutationFn: (plan: string) =>
      api.post<{ url: string }>('/api/billing/checkout', { plan, region, annual }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>('/api/billing/portal'),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const currentPlan = billing?.plan ?? 'starter';

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Account */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row
            label="Plan"
            value={
              <span className="capitalize font-medium text-brand-700">{currentPlan}</span>
            }
          />
          {billing?.current_period_end && (
            <Row
              label="Renews"
              value={new Date(billing.current_period_end * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          )}
        </div>
        {billing?.has_subscription && (
          <button
            onClick={() => portal.mutate()}
            className="btn-secondary mt-3"
            disabled={portal.isPending}
          >
            <ExternalLink size={14} />
            {portal.isPending ? 'Loading…' : 'Manage billing'}
          </button>
        )}
      </section>

      {/* Upgrade */}
      {!billing?.has_subscription && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Choose a plan</h2>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['global', 'my', 'ph'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    region === r
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r === 'global' ? 'USD' : r === 'my' ? 'MYR' : 'PHP'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={annual}
                onChange={(e) => setAnnual(e.target.checked)}
                className="rounded border-gray-300 text-brand-600"
              />
              Annual billing{' '}
              <span className="text-green-600 font-medium">save 17%</span>
            </label>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const price = plan.prices[region];
              const finalPrice = annual ? Math.round(price * 0.83) : price;
              const isCurrent = currentPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl border-2 p-5 flex flex-col ${
                    isCurrent ? 'border-brand-500' : 'border-gray-200'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 flex-1">{plan.description}</p>
                  <div className="mt-3 mb-4">
                    <span className="text-2xl font-bold text-gray-900">{finalPrice}</span>
                    <span className="text-sm text-gray-500">
                      {' '}
                      {CURRENCY[region]}/mo
                    </span>
                    {annual && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Billed {finalPrice * 12} {CURRENCY[region]}/year
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {plan.sites === Infinity ? 'Unlimited sites' : `Up to ${plan.sites} sites`}
                  </p>
                  {isCurrent ? (
                    <span className="text-xs font-medium text-brand-600 text-center py-1.5">
                      Current plan
                    </span>
                  ) : (
                    <button
                      className="btn-primary justify-center text-xs"
                      onClick={() => checkout.mutate(plan.id)}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending ? 'Loading…' : 'Upgrade'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
