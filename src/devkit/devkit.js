// Dev kit: a small corner button that opens a menu of developer tools.
// Tools are { id, label, detail, open() }. Settings are dropdowns:
// { id, label, options: [{ value, label }], value, onChange(value) }.
import { injectDevKitStyles } from './style.js';

export function createDevKit({ tools, settings = [] }) {
  injectDevKitStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dk-button';
  button.textContent = 'DEV';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'dk-menu');
  button.title = 'Dev kit';

  const menu = document.createElement('div');
  menu.className = 'dk-menu';
  menu.id = 'dk-menu';
  menu.hidden = true;
  menu.innerHTML = '<h2>Dev kit</h2>';
  for (const setting of settings) {
    const label = document.createElement('label');
    label.className = 'dk-setting';
    label.textContent = setting.label;
    const select = document.createElement('select');
    select.id = `dk-${setting.id}`;
    for (const o of setting.options) select.append(new Option(o.label, o.value, false, o.value === setting.value));
    select.addEventListener('change', () => {
      setOpen(false);
      setting.onChange(select.value);
      select.blur();
    });
    label.append(select);
    menu.append(label);
  }
  for (const tool of tools) {
    const item = document.createElement('button');
    item.type = 'button';
    item.innerHTML = `${tool.label}<span>${tool.detail}</span>`;
    item.addEventListener('click', () => {
      setOpen(false);
      tool.open();
    });
    menu.append(item);
  }

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }
  button.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== button) setOpen(false);
  });

  document.body.append(button, menu);
  return {
    close: () => setOpen(false),
    get isOpen() {
      return !menu.hidden;
    },
  };
}
