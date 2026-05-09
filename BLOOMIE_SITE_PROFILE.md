# SABWB Bloomie Site Profile

This file tells Bloomie how to manage the SABWB website without rebuilding the wrong thing.

## Site Identity

- Client: San Antonio Biblical Worldview Builders (SABWB)
- Production URL: https://sabwb-redesign.vercel.app
- Hosting: Vercel
- App type: Express server serving static HTML pages
- Primary entry: `server.js`
- Public pages:
  - `index.html`
  - `events.html`
  - `live.html`
  - `book.html`
  - `admin.html` fallback event editor

## Editing Rules

- Preserve the current visual design unless Kimberly explicitly asks for a redesign.
- Do not replace `events.html` with a generic landing page.
- Treat `events.html` as the canonical event-detail template.
- For event updates, keep the Eventbrite-style layout: hero, event details, speakers, schedule, registration sidebar, gallery, and more events.
- Registration must route through GoHighLevel links.
- Paid events should point to a GHL paid registration/order form or a GHL booking URL that collects payment.
- Free events should point to the event's GHL booking/calendar URL.

## Current Integrations

### GoHighLevel

Current default booking URL:

```text
https://api.leadconnectorhq.com/widget/booking/7Zb2YaNTDpgEZxpAPkli
```

The site currently reads event registration URLs from Vercel environment variables via `/api/event-links`.

Important env vars:

```text
GHL_ALL_EVENTS_URL
GHL_CONFERENCE_CALENDAR_URL
GHL_MARCH_MIXER_CALENDAR_URL
GHL_BUSINESS_MEETUP_CALENDAR_URL
GHL_RALLY_CALENDAR_URL
```

### YouTube Live

The live page polls `/api/youtube-live`.

Required env vars:

```text
YOUTUBE_CHANNEL_ID
YOUTUBE_API_KEY
```

When the configured channel is live, `live.html` should show the YouTube stream and YouTube live chat.

### Supabase

Supabase is intended for event data and the fallback `/admin` editor.

Required env vars:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Run `supabase-schema.sql` in the Supabase SQL Editor before using `/admin`.

## Bloomie Recommended Access

Bloomie should use this site as a project, not invent a separate CMS unless asked.

Recommended project capabilities:

- Read and update this GitHub repository.
- Trigger Vercel production deploys after approved changes.
- Read/update SABWB event rows in Supabase if the database is enabled.
- Read/update GHL event registration URLs or calendar IDs for SABWB.
- Use the existing Bloomie GrapesJS editor for page-level HTML artifact edits when a page is created inside Bloomie.

## Safe Workflow For Bloomie

For a new event:

1. Create or update the event in Supabase or GHL, depending on the final source of truth.
2. Add the event's GHL registration/payment URL.
3. Render the event using the current `events.html` design language.
4. Update homepage event cards only if the event should be featured.
5. Deploy through Vercel.
6. Verify:
   - homepage event card opens the correct GHL URL
   - event detail page still matches the current design
   - registration opens GHL
   - mobile layout remains readable

For a new page:

1. Use Bloomie's Build tab/GrapesJS pipeline if this is a standalone editable page.
2. If the page belongs inside this Vercel site, create the page in this repo and preserve SABWB navigation/footer styling.
3. Do not overwrite existing pages unless Kimberly explicitly requests replacement.

## Human Admin

`/admin` is a fallback WordPress-style event editor. It is useful for simple event changes, but Bloomie's existing Build tab and GrapesJS editor should remain the main page-editing environment if SABWB is managed through Bloomie.
