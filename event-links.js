(function () {
  const fallbackLinks = {
    conference: 'events.html',
    allEvents: 'events.html',
  };

  function getLink(links, key) {
    return links[key] || fallbackLinks[key] || null;
  }

  function applyEventLinks(links) {
    document.querySelectorAll('[data-event-link]').forEach((el) => {
      const key = el.dataset.eventLink;
      const href = getLink(links, key);

      if (!href) {
        el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', (event) => event.preventDefault());
        return;
      }

      el.href = href;
      if (/^https?:\/\//i.test(href) && !href.includes(window.location.hostname)) {
        el.target = '_blank';
        el.rel = 'noopener';
      }
    });

    document.querySelectorAll('[data-event-form]').forEach((form) => {
      const key = form.dataset.eventForm;
      const href = getLink(links, key);
      form.dataset.eventHref = href || '';
      const btn = form.querySelector('[type="submit"]');
      if (btn && href) btn.textContent = btn.dataset.readyText || btn.textContent;
    });
  }

  fetch('/api/event-links')
    .then((response) => response.json())
    .then(applyEventLinks)
    .catch(() => applyEventLinks({}));
})();
