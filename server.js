/**
 * SABWB Stripe Subscription Server
 *
 * SETUP:
 * 1. Install dependencies: npm install express stripe cors dotenv
 * 2. Create a .env file with your Stripe keys (see .env.example)
 * 3. Create products/prices in Stripe Dashboard (or use the auto-create below)
 * 4. Run: node server.js
 * 5. Update STRIPE_PK in index.html with your real publishable key
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getSupabase } = require('./lib/supabase');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl === '/api/webhook') req.rawBody = buf;
  },
}));

// ===== STRIPE CONFIG =====
const stripeKey = process.env.STRIPE_SECRET_KEY;
const hasStripe = stripeKey && !stripeKey.includes('placeholder');
const stripe = hasStripe ? require('stripe')(stripeKey) : null;

// Map tier amounts (in dollars) to Stripe Price IDs
// Create these in your Stripe Dashboard under Products > Pricing
// Or use the /api/setup endpoint below to auto-create them
const PRICE_IDS = {
  10: process.env.STRIPE_PRICE_10 || null,
  25: process.env.STRIPE_PRICE_25 || null,
  50: process.env.STRIPE_PRICE_50 || null,
  100: process.env.STRIPE_PRICE_100 || null,
};

let youtubeLiveCache = {
  checkedAt: 0,
  data: null,
};

app.get('/api/stripe-config', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  res.json({
    publishableKey: publishableKey && !publishableKey.includes('placeholder') ? publishableKey : null,
  });
});

app.get('/api/youtube-live', async (req, res) => {
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!channelId || !apiKey) {
    return res.json({
      configured: false,
      live: false,
      message: 'YouTube live detection is not configured yet.',
    });
  }

  const cacheTtlMs = 60 * 1000;
  if (youtubeLiveCache.data && Date.now() - youtubeLiveCache.checkedAt < cacheTtlMs) {
    return res.json(youtubeLiveCache.data);
  }

  try {
    const searchLive = async (eventType) => {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('channelId', channelId);
      url.searchParams.set('eventType', eventType);
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', '1');
      url.searchParams.set('order', 'date');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Unable to check YouTube live status.');
      }
      return data.items?.[0] || null;
    };

    const liveVideo = await searchLive('live');
    const upcomingVideo = liveVideo ? null : await searchLive('upcoming');
    const video = liveVideo || upcomingVideo;

    const payload = {
      configured: true,
      live: Boolean(liveVideo),
      upcoming: Boolean(upcomingVideo),
      videoId: video?.id?.videoId || null,
      title: video?.snippet?.title || null,
      channelTitle: video?.snippet?.channelTitle || null,
      checkedAt: new Date().toISOString(),
    };

    youtubeLiveCache = { checkedAt: Date.now(), data: payload };
    return res.json(payload);
  } catch (err) {
    const payload = {
      configured: true,
      live: false,
      error: err.message,
      checkedAt: new Date().toISOString(),
    };
    youtubeLiveCache = { checkedAt: Date.now(), data: payload };
    return res.status(502).json(payload);
  }
});

app.get('/api/event-links', (req, res) => {
  res.json({
    allEvents: process.env.GHL_ALL_EVENTS_URL || null,
    conference: process.env.GHL_CONFERENCE_CALENDAR_URL || null,
    marchMixer: process.env.GHL_MARCH_MIXER_CALENDAR_URL || null,
    businessMeetup: process.env.GHL_BUSINESS_MEETUP_CALENDAR_URL || null,
    rally: process.env.GHL_RALLY_CALENDAR_URL || null,
  });
});

app.get('/api/supabase-config', (req, res) => {
  res.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || null,
  });
});

app.get('/api/events', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.json({ configured: false, events: [] });
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('published', true)
      .order('starts_at', { ascending: true });

    if (error) throw error;
    return res.json({ configured: true, events: data || [] });
  } catch (err) {
    return res.status(502).json({
      configured: true,
      events: [],
      error: err.message,
    });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== AUTO-CREATE PRODUCTS & PRICES =====
// Run once: visit http://localhost:3000/api/setup
app.get('/api/setup', async (req, res) => {
  if (!stripe) return res.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' });
  try {
    const tiers = [
      { amount: 10, name: 'SABWB Supporter', desc: 'Monthly partnership — Full platform access' },
      { amount: 25, name: 'SABWB Partner', desc: 'Monthly partnership — Platform + Book' },
      { amount: 50, name: 'SABWB Champion', desc: 'Monthly partnership — VIP access' },
      { amount: 100, name: 'SABWB Catalyst', desc: 'Monthly partnership — Maximum impact' },
    ];

    const results = [];

    for (const tier of tiers) {
      // Create product
      const product = await stripe.products.create({
        name: tier.name,
        description: tier.desc,
      });

      // Create recurring price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.amount * 100, // Stripe uses cents
        currency: 'usd',
        recurring: { interval: 'month' },
      });

      results.push({
        amount: tier.amount,
        productId: product.id,
        priceId: price.id,
      });
    }

    res.json({
      success: true,
      message: 'Products and prices created! Add these Price IDs to your .env file:',
      prices: results,
      envFormat: results.map(r => `STRIPE_PRICE_${r.amount}=${r.priceId}`).join('\n'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE SUBSCRIPTION =====
app.post('/api/create-subscription', async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured. Add your secret key to .env' });
  const { paymentMethodId, email, name, amount, tier } = req.body;

  try {
    // Get or create the Price ID for this tier
    let priceId = PRICE_IDS[amount];

    if (!priceId) {
      // Auto-create if not configured (for development)
      const product = await stripe.products.create({
        name: `SABWB ${tier}`,
        description: `SABWB ${tier} — $${amount}/mo partnership`,
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount * 100,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      priceId = price.id;
      console.log(`Auto-created price for $${amount}: ${priceId}`);
    }

    // Create or retrieve customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Attach payment method if existing customer
    if (customers.data.length > 0) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = subscription.latest_invoice;
    const paymentIntent = invoice.payment_intent;

    if (paymentIntent.status === 'requires_action') {
      return res.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
      });
    }

    return res.json({
      success: true,
      subscriptionId: subscription.id,
      customerId: customer.id,
    });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ===== ONE-TIME BOOK PAYMENT =====
app.post('/api/create-book-payment', async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured. Add your secret key to .env' });
  const { paymentMethodId, email, name, amount, product } = req.body;

  try {
    // Create or retrieve customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        payment_method: paymentMethodId,
      });
    }

    // Create one-time payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // cents
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      description: `Book Purchase: ${product}`,
      receipt_email: email,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    if (paymentIntent.status === 'requires_action') {
      return res.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      });
    }

    return res.json({
      success: true,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Book payment error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ===== WEBHOOK (for subscription status updates) =====
app.post('/api/webhook', (req, res) => {
  if (!stripe) return res.status(400).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'customer.subscription.created':
      console.log('New subscription:', event.data.object.id);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription cancelled:', event.data.object.id);
      break;
    case 'invoice.payment_succeeded':
      console.log('Payment succeeded:', event.data.object.id);
      break;
    case 'invoice.payment_failed':
      console.log('Payment failed:', event.data.object.id);
      break;
  }

  res.json({ received: true });
});

// ===== START SERVER =====
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n  SABWB Server running at http://localhost:${PORT}`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  Website:  http://localhost:${PORT}`);
    console.log(`  Events:   http://localhost:${PORT}/events.html`);
    console.log(`  Setup:    http://localhost:${PORT}/api/setup (run once to create Stripe products)`);
    if (!hasStripe) console.log(`\n  ⚠ Stripe not configured — add your key to .env to enable payments\n`);
    else console.log('');
  });
}

module.exports = app;
