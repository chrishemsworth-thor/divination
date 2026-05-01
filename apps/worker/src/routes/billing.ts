import { Hono } from 'hono';
import type { Bindings, Variables } from '../types.js';
import { requireAuth } from '../lib/middleware.js';
import {
  getStripe,
  createCheckoutSession,
  createBillingPortalSession,
  createStripeCustomer,
  planFromPriceId,
} from '../lib/stripe.js';
import { generateId } from '../lib/auth.js';

const billing = new Hono<{ Bindings: Bindings; Variables: Variables }>();

billing.get('/status', requireAuth, async (c) => {
  const userId = c.get('userId');
  const record = await c.env.DB.prepare('SELECT * FROM billing WHERE user_id = ?')
    .bind(userId)
    .first<{
      plan: string;
      status: string;
      region: string;
      current_period_end: number | null;
      stripe_customer_id: string | null;
    }>();

  return c.json({
    plan: record?.plan ?? 'starter',
    status: record?.status ?? 'trialing',
    region: record?.region ?? 'global',
    current_period_end: record?.current_period_end ?? null,
    has_subscription: !!record?.stripe_customer_id,
  });
});

billing.post('/checkout', requireAuth, async (c) => {
  const userId = c.get('userId');

  let body: { plan?: string; region?: string; annual?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const plan = (['starter', 'growth', 'agency'].includes(body.plan ?? '')
    ? body.plan
    : 'starter') as 'starter' | 'growth' | 'agency';
  const region = (['global', 'my', 'ph'].includes(body.region ?? '')
    ? body.region
    : 'global') as 'global' | 'my' | 'ph';
  const annual = body.annual ?? false;

  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string }>();
  if (!user) return c.json({ error: 'User not found' }, 404);

  let billingRecord = await c.env.DB.prepare('SELECT * FROM billing WHERE user_id = ?')
    .bind(userId)
    .first<{ stripe_customer_id: string | null }>();

  const stripe = getStripe(c.env);

  let customerId = billingRecord?.stripe_customer_id ?? null;
  if (!customerId) {
    customerId = await createStripeCustomer(stripe, user.email);
    if (!billingRecord) {
      const id = generateId();
      await c.env.DB.prepare(
        'INSERT INTO billing (id, user_id, stripe_customer_id, plan, status, region) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(id, userId, customerId, plan, 'trialing', region)
        .run();
    } else {
      await c.env.DB.prepare(
        'UPDATE billing SET stripe_customer_id = ? WHERE user_id = ?',
      )
        .bind(customerId, userId)
        .run();
    }
  }

  const appUrl = c.env.APP_URL;
  const checkoutUrl = await createCheckoutSession(stripe, c.env, {
    customerId,
    plan,
    region,
    annual,
    successUrl: `${appUrl}/settings?checkout=success`,
    cancelUrl: `${appUrl}/settings?checkout=cancel`,
  });

  return c.json({ url: checkoutUrl });
});

billing.post('/portal', requireAuth, async (c) => {
  const userId = c.get('userId');
  const record = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM billing WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ stripe_customer_id: string | null }>();

  if (!record?.stripe_customer_id) {
    return c.json({ error: 'No billing account found' }, 404);
  }

  const stripe = getStripe(c.env);
  const url = await createBillingPortalSession(
    stripe,
    record.stripe_customer_id,
    `${c.env.APP_URL}/settings`,
  );

  return c.json({ url });
});

// Stripe webhook
billing.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing signature' }, 400);

  const stripe = getStripe(c.env);
  const body = await c.req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = c.env.DB;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string;
        customer: string;
        status: string;
        current_period_end: number;
        items: { data: Array<{ price: { id: string } }> };
      };
      const priceId = sub.items.data[0]?.price.id ?? '';
      const plan = planFromPriceId(c.env, priceId);

      await db
        .prepare(
          `UPDATE billing SET
            stripe_subscription_id = ?,
            plan = ?,
            status = ?,
            current_period_end = ?
           WHERE stripe_customer_id = ?`,
        )
        .bind(sub.id, plan, sub.status, sub.current_period_end, sub.customer)
        .run();
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { customer: string };
      await db
        .prepare(
          "UPDATE billing SET status = 'cancelled', stripe_subscription_id = NULL WHERE stripe_customer_id = ?",
        )
        .bind(sub.customer)
        .run();
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as { customer: string };
      await db
        .prepare("UPDATE billing SET status = 'past_due' WHERE stripe_customer_id = ?")
        .bind(inv.customer)
        .run();
      break;
    }
  }

  return c.json({ received: true });
});

export { billing };
