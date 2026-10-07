(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      toggle.classList.toggle('is-open', open);
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      nav.classList.remove('open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    });
  }

  document.querySelectorAll('[data-plan-button]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.planButton;
      document.querySelectorAll('[data-plan-button]').forEach((item) => {
        item.setAttribute('aria-selected', String(item === button));
      });
      document.querySelectorAll('[data-editorial-plan]').forEach((plan) => {
        plan.classList.toggle('is-active', plan.dataset.editorialPlan === id);
      });
    });
  });

  document.querySelectorAll('.faq-item button').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
      button.querySelector('span').textContent = open ? '−' : '+';
    });
  });

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const message = [
        'Hello, I would like to enquire about Deccan Imperia.',
        `Name: ${data.get('name') || ''}`,
        `Phone: ${data.get('phone') || ''}`,
        `Interested in: ${data.get('interest') || 'Site visit'}`,
        `Preferred date: ${data.get('date') || 'Please suggest'}`,
        `Message: ${data.get('message') || '-'}`
      ].join('\n');
      window.open(`https://wa.me/919970353935?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      const status = form.querySelector('.form-status');
      if (status) status.textContent = 'Opening WhatsApp with your enquiry…';
    });
  }
})();
