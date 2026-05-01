export type User = {
  id: string;
  email: string;
  name: string;
};

export type Site = {
  id: string;
  user_id: string;
  domain: string;
  name: string;
  tracking_method: 'pixel' | 'js';
  platform: string;
  cname_slug: string;
  share_token: string | null;
  alerts_enabled: number;
  status: 'pending' | 'active' | 'inactive';
  created_at: number;
};

export type AnalyticsOverview = {
  days: number;
  totals: {
    pageviews: number;
    unique_paths: number;
  };
  timeseries: Array<{ day: string; views: number }>;
  top_pages: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; visits: number }>;
  countries: Array<{ country: string; visits: number }>;
  devices: Array<{ device: string; count: number }>;
};

export type BillingStatus = {
  plan: 'starter' | 'growth' | 'agency';
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  region: 'global' | 'my' | 'ph';
  current_period_end: number | null;
  has_subscription: boolean;
};

export type ShareData = {
  site: { domain: string; name: string; platform: string };
  days: number;
  totals: { pageviews: number };
  timeseries: Array<{ day: string; views: number }>;
  top_pages: Array<{ path: string; views: number }>;
  top_referrers: Array<{ referrer: string; visits: number }>;
  countries: Array<{ country: string; visits: number }>;
  devices: Array<{ device: string; count: number }>;
};
