import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const $ = (id) => document.getElementById(id);
let supabase;
let events = [];

const fields = [
  'eventId', 'title', 'slug', 'eventType', 'location', 'startsAt', 'endsAt',
  'shortDescription', 'fullDescription', 'heroImageUrl', 'cardImageUrl',
  'registrationUrl', 'liveUrl', 'ticketPrice', 'venueNote', 'speakers',
  'schedule', 'galleryImages'
];

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function parseLines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseSimplePeople(value) {
  return parseLines(value).map((line) => {
    const [name = '', role = '', imageUrl = '', bio = ''] = line.split('|').map((part) => part.trim());
    return { name, role, imageUrl, bio };
  });
}

function parseSimpleSchedule(value) {
  return parseLines(value).map((line) => {
    const [time = '', title = '', description = ''] = line.split('|').map((part) => part.trim());
    return { time, title, description };
  });
}

function stringifyPeople(value) {
  return (value || []).map((person) => [person.name, person.role, person.imageUrl, person.bio].filter(Boolean).join(' | ')).join('\n');
}

function stringifySchedule(value) {
  return (value || []).map((item) => [item.time, item.title, item.description].filter(Boolean).join(' | ')).join('\n');
}

function showAuthed(isAuthed) {
  $('loginPanel').classList.toggle('hidden', isAuthed);
  $('listPanel').classList.toggle('hidden', !isAuthed);
  $('editorPanel').classList.toggle('hidden', !isAuthed);
  $('signOutBtn').classList.toggle('hidden', !isAuthed);
}

function clearForm() {
  fields.forEach((id) => { $(id).value = ''; });
  $('eventType').value = 'Event';
  $('venueNote').value = 'Venue details sent upon registration';
  $('isPaid').checked = false;
  $('published').checked = false;
  $('showOnHomepage').checked = true;
  $('editorTitle').textContent = 'New Event';
  $('deleteBtn').classList.add('hidden');
}

function fillForm(event) {
  $('eventId').value = event.id;
  $('title').value = event.title || '';
  $('slug').value = event.slug || '';
  $('eventType').value = event.event_type || 'Event';
  $('location').value = event.location || '';
  $('startsAt').value = toLocalInput(event.starts_at);
  $('endsAt').value = toLocalInput(event.ends_at);
  $('shortDescription').value = event.short_description || '';
  $('fullDescription').value = event.full_description || '';
  $('heroImageUrl').value = event.hero_image_url || '';
  $('cardImageUrl').value = event.card_image_url || '';
  $('registrationUrl').value = event.registration_url || '';
  $('liveUrl').value = event.live_url || '';
  $('ticketPrice').value = event.ticket_price || '';
  $('venueNote').value = event.venue_note || '';
  $('speakers').value = stringifyPeople(event.speakers);
  $('schedule').value = stringifySchedule(event.schedule);
  $('galleryImages').value = (event.gallery_images || []).join('\n');
  $('isPaid').checked = Boolean(event.is_paid);
  $('published').checked = Boolean(event.published);
  $('showOnHomepage').checked = Boolean(event.show_on_homepage);
  $('editorTitle').textContent = `Editing: ${event.title}`;
  $('deleteBtn').classList.remove('hidden');
}

function getPayload() {
  return {
    title: $('title').value.trim(),
    slug: $('slug').value.trim() || slugify($('title').value),
    event_type: $('eventType').value.trim() || 'Event',
    starts_at: $('startsAt').value ? new Date($('startsAt').value).toISOString() : null,
    ends_at: $('endsAt').value ? new Date($('endsAt').value).toISOString() : null,
    location: $('location').value.trim() || null,
    venue_note: $('venueNote').value.trim() || null,
    hero_image_url: $('heroImageUrl').value.trim() || null,
    card_image_url: $('cardImageUrl').value.trim() || null,
    short_description: $('shortDescription').value.trim() || null,
    full_description: $('fullDescription').value.trim() || null,
    speakers: parseSimplePeople($('speakers').value),
    schedule: parseSimpleSchedule($('schedule').value),
    gallery_images: parseLines($('galleryImages').value),
    is_paid: $('isPaid').checked,
    ticket_price: $('ticketPrice').value ? Number($('ticketPrice').value) : null,
    registration_url: $('registrationUrl').value.trim() || null,
    live_url: $('liveUrl').value.trim() || null,
    show_on_homepage: $('showOnHomepage').checked,
    published: $('published').checked,
  };
}

function renderEvents() {
  $('eventList').innerHTML = events.length
    ? events.map((event) => `
      <button class="event-item" data-id="${event.id}">
        <strong>${event.title}</strong>
        <span>${event.published ? 'Published' : 'Draft'}${event.starts_at ? ' · ' + new Date(event.starts_at).toLocaleString() : ''}</span>
      </button>
    `).join('')
    : '<p class="status">No events yet. Create the first one.</p>';

  document.querySelectorAll('.event-item').forEach((button) => {
    button.addEventListener('click', () => fillForm(events.find((event) => event.id === button.dataset.id)));
  });
}

async function loadEvents() {
  const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: true });
  if (error) {
    $('saveStatus').textContent = error.message;
    return;
  }
  events = data || [];
  renderEvents();
}

async function init() {
  const config = await fetch('/api/supabase-config').then((res) => res.json());
  if (!config.url || !config.publishableKey) {
    $('loginStatus').textContent = 'Supabase is not configured yet.';
    return;
  }

  supabase = createClient(config.url, config.publishableKey);
  const { data } = await supabase.auth.getSession();
  showAuthed(Boolean(data.session));
  if (data.session) await loadEvents();

  supabase.auth.onAuthStateChange((_event, session) => {
    showAuthed(Boolean(session));
    if (session) loadEvents();
  });
}

$('loginBtn').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) {
    $('loginStatus').textContent = 'Enter your email and password.';
    return;
  }

  $('loginStatus').textContent = 'Logging in...';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $('loginStatus').textContent = error ? error.message : '';
});

$('magicLinkBtn').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/admin.html` },
  });
  $('loginStatus').textContent = error ? error.message : 'Check your email for the secure login link.';
});

$('signOutBtn').addEventListener('click', () => supabase.auth.signOut());
$('newEventBtn').addEventListener('click', clearForm);
$('resetBtn').addEventListener('click', clearForm);
$('title').addEventListener('input', () => {
  if (!$('eventId').value) $('slug').value = slugify($('title').value);
});

$('eventForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('saveStatus').textContent = 'Saving...';
  const id = $('eventId').value;
  const payload = getPayload();
  const query = id
    ? supabase.from('events').update(payload).eq('id', id).select().single()
    : supabase.from('events').insert(payload).select().single();
  const { data, error } = await query;

  if (error) {
    $('saveStatus').textContent = error.message;
    return;
  }

  $('saveStatus').textContent = 'Saved';
  await loadEvents();
  fillForm(data);
});

$('deleteBtn').addEventListener('click', async () => {
  const id = $('eventId').value;
  if (!id || !confirm('Delete this event?')) return;
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) {
    $('saveStatus').textContent = error.message;
    return;
  }
  clearForm();
  await loadEvents();
});

init();
