export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_STARTER_PRICE_ID_GLOBAL: string;
  STRIPE_STARTER_PRICE_ID_MY: string;
  STRIPE_STARTER_PRICE_ID_PH: string;
  STRIPE_GROWTH_PRICE_ID_GLOBAL: string;
  STRIPE_GROWTH_PRICE_ID_MY: string;
  STRIPE_GROWTH_PRICE_ID_PH: string;
  STRIPE_AGENCY_PRICE_ID_GLOBAL: string;
  STRIPE_AGENCY_PRICE_ID_MY: string;
  STRIPE_AGENCY_PRICE_ID_PH: string;
  RESEND_API_KEY: string;
  AUTH_SECRET: string;
  APP_URL: string;
};

export type Variables = {
  userId: string;
  sessionId: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  hashed_password: string;
  created_at: number;
};

export type Session = {
  id: string;
  user_id: string;
  expires_at: number;
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
  share_password_hash: string | null;
  alerts_enabled: number;
  status: 'pending' | 'active' | 'inactive';
  created_at: number;
};

export type Pageview = {
  id: number;
  site_id: string;
  path: string;
  referrer: string;
  country: string;
  device: string;
  browser: string;
  timestamp: number;
};

export type Billing = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: 'starter' | 'growth' | 'agency';
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  region: 'global' | 'my' | 'ph';
  current_period_end: number | null;
  created_at: number;
};

export type Plan = 'starter' | 'growth' | 'agency';

export const PLAN_LIMITS: Record<Plan, number> = {
  starter: 3,
  growth: 10,
  agency: Infinity,
};
