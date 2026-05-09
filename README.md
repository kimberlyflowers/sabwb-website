# SABWB Website

SABWB website for Southern Arizona Black Women in Business.

Live site: https://sabwb-redesign.vercel.app

## Local Development

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Key Pages

- `/` - homepage
- `/events.html` - main events and registration page
- `/live.html` - live stream page with YouTube embed support
- `/book.html` - booking / consultation page
- `/admin` - fallback admin editor

## Integrations

- GoHighLevel booking calendar is configured through the event link API.
- YouTube live detection requires `YOUTUBE_CHANNEL_ID` and `YOUTUBE_API_KEY`.
- Stripe requires `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`.
- Supabase is used for the fallback admin/events workflow.

See `BLOOMIE_SITE_PROFILE.md` for Bloomie-specific editing and deployment guidance.
