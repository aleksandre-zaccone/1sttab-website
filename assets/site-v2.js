'use strict';

document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const menu = document.getElementById('site-menu');

function setMenu(open) {
  if (!menuButton || !menu) return;
  menu.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}

menuButton?.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});
matchMedia('(min-width:681px)').addEventListener('change', () => setMenu(false));

const screenshot = document.getElementById('workspace-image');
const caption = document.getElementById('preview-caption');
const previewButtons = document.querySelectorAll('[data-preview]');
const previewViews = {
  list: {
    src: 'assets/bookmark-v2-list.png',
    alt: '1stTab v2 list view with a nested folder tree, bookmark tags, search and compact rows',
    caption: 'List view · Enterprise theme'
  },
  cards: {
    src: 'assets/bookmark-v2-cards.png',
    alt: '1stTab v2 card view with colorful bookmark icons, tags, notes and a nested folder tree',
    caption: 'Card view · Enterprise theme'
  }
};
caption?.setAttribute('aria-live', 'polite');
for (const button of previewButtons) {
  button.addEventListener('click', () => {
    const view = previewViews[button.dataset.preview];
    if (!screenshot || !view) return;
    screenshot.src = view.src;
    screenshot.alt = view.alt;
    if (caption) caption.textContent = view.caption;
    for (const other of previewButtons) {
      other.setAttribute('aria-pressed', String(other === button));
    }
  });
}

// Article galleries build the image path from one choice per group,
// e.g. data-pattern="themes/{theme}-{mode}.png". A group is either a set of
// pressed buttons or a range input whose steps map to data-values.
for (const gallery of document.querySelectorAll('[data-gallery]')) {
  // Each image may override the gallery's pattern and alt text, so one set of
  // controls can drive several related screenshots.
  const images = gallery.querySelectorAll('[data-gallery-image]');
  const label = gallery.querySelector('[data-gallery-caption]');
  const controls = gallery.querySelectorAll('[data-group]');
  const selected = {};
  label?.setAttribute('aria-live', 'polite');

  function rangeChoice(range) {
    const value = range.dataset.values.split(',')[range.value];
    const text = range.dataset.label.replace('{value}', value);
    range.setAttribute('aria-valuetext', text);
    const output = range.parentElement.querySelector('output');
    if (output) output.value = `${value}%`;
    return {option: value, label: text};
  }

  for (const control of controls) {
    const group = control.dataset.group;
    if (control.type === 'range') selected[group] = rangeChoice(control);
    else if (control.getAttribute('aria-pressed') === 'true') selected[group] = {option: control.dataset.option, label: control.dataset.label, button: control};
  }

  function showSelection() {
    const labels = Object.values(selected).map(choice => choice.label);
    if (label) label.textContent = labels.join(' · ');
    for (const image of images) {
      const pattern = image.dataset.pattern || gallery.dataset.pattern;
      const src = pattern.replace(/\{(\w+)\}/g, (_, group) => selected[group]?.option || '');
      const next = new Image();
      // Swap only once the new screenshot is ready, so the figure never flashes empty.
      next.onload = () => {
        if (image.dataset.pending !== src) return;
        image.src = src;
        image.alt = (image.dataset.alt || gallery.dataset.alt).replace('{label}', labels.join(', '));
      };
      image.dataset.pending = src;
      next.src = src;
    }
  }

  for (const control of controls) {
    const group = control.dataset.group;
    if (control.type === 'range') {
      control.addEventListener('input', () => {
        selected[group] = rangeChoice(control);
        showSelection();
      });
      continue;
    }
    control.addEventListener('click', () => {
      if (selected[group]?.button === control) return;
      selected[group]?.button.setAttribute('aria-pressed', 'false');
      control.setAttribute('aria-pressed', 'true');
      selected[group] = {option: control.dataset.option, label: control.dataset.label, button: control};
      showSelection();
    });
  }
}

for (const form of document.querySelectorAll('[data-feedback]')) {
  const result = form.querySelector('.draft-result');
  const output = form.querySelector('#draft-message');
  const status = form.querySelector('.draft-status');
  const email = form.querySelector('.draft-email');
  form.querySelector('button[type=submit]').disabled = false;
  status.tabIndex = -1;

  // A changed report must be prepared again before it can be copied or sent.
  function invalidateDraft(event) {
    if (!event.target.matches('input[name], select[name], textarea[name]')) return;
    event.target.setCustomValidity('');
    result.hidden = true;
    output.value = '';
    email.removeAttribute('href');
    status.textContent = '';
  }
  form.addEventListener('input', invalidateDraft);
  form.addEventListener('change', invalidateDraft);

  form.addEventListener('submit', event => {
    event.preventDefault();
    for (const field of form.querySelectorAll('[required]')) {
      field.setCustomValidity(field.value.trim() ? '' : 'Please enter more than spaces.');
    }
    if (!form.reportValidity()) return;

    const labels = {
      area: 'Area',
      title: 'Summary',
      description: 'Idea',
      'use-case': 'Workflow',
      steps: 'Steps to reproduce',
      expected: 'Expected result',
      actual: 'Actual result',
      environment: 'Environment'
    };
    const values = new FormData(form);
    const parts = [];
    for (const [key, label] of Object.entries(labels)) {
      const value = String(values.get(key) || '').trim();
      if (value) parts.push(`${label}\n${value}`);
    }
    const kind = form.dataset.feedback === 'bug' ? 'Bug report' : 'Feature idea';
    const message = `1stTab v2 — ${kind}\n\n${parts.join('\n\n')}`;
    const subject = `[1stTab v2] ${kind}: ${String(values.get('title') || '').trim()}`;
    output.value = message;
    email.href = `mailto:aablotia@ablotia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    result.hidden = false;
    status.textContent = 'Draft ready. Open your email app to review and send it.';
    status.focus({preventScroll: true});
    result.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'nearest'
    });
  });

  form.querySelector('.copy-draft').addEventListener('click', async () => {
    const message = output.value;
    try {
      await navigator.clipboard.writeText(message);
      if (!result.hidden && output.value === message) {
        status.textContent = 'Message copied. Paste it into an email to aablotia@ablotia.com.';
      }
    } catch {
      if (!result.hidden && output.value === message) {
        output.focus();
        output.select();
        status.textContent = 'Select and copy the message, then paste it into your email.';
      }
    }
  });
}
