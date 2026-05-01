import Stripe from 'stripe';
import type { Bindings, Plan } from '../types.js';

export function getStripe(env: Bindings): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

type Region = 'global' | 'my' | 'ph';

export function getPriceId(env: Bindings, plan: Plan, region: Region): string {
  const key = `STRIPE_${plan.toUpperCase()}_PRICE_ID_${region.toUpperCase()}` as keyof Bindings;
  return env[key] as string;
}

export async function createCheckoutSession(
  stripe: Stripe,
  env: Bindings,
  opts: {
    customerId: string;
    plan: Plan;
    region: Region;
    annual: boolean;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<string> {
  const priceId = getPriceId(env, opts.plan, opts.region);
  const session = await stripe.checkout.sessions.create({
    customer: opts.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: opts.annual ? { trial_period_days: 0 } : undefined,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
  });
  return session.url ?? opts.cancelUrl;
}

export async function createBillingPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function createStripeCustomer(stripe: Stripe, email: string): Promise<string> {
  const customer = await stripe.customers.create({ email });
  return customer.id;
}

export function planFromPriceId(env: Bindings, priceId: string): Plan {
  const plans: Plan[] = ['starter', 'growth', 'agency'];
  const regions: Region[] = ['global', 'my', 'ph'];
  for (const plan of plans) {
    for (const region of regions) {
      if (getPriceId(env, plan, region) === priceId) return plan;
    }
  }
  return 'starter';
}
