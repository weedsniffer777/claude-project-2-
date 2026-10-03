// Styles for the dev kit button, menu and tool panels. Injected once, so
// every page that mounts dev tools gets them (game, viewer.html, artifact).
const CSS = `
:root {
  --dk-panel: rgba(22, 27, 22, 0.9);
  --dk-edge: rgba(150, 168, 122, 0.35);
  --dk-ink: #e6eadb;
  --dk-muted: #a3ad92;
  --dk-accent: #b9c98a;
  --dk-accent-ink: #1d2414;
  --dk-font-label: 'Chakra Petch', 'Segoe UI', system-ui, sans-serif;
  --dk-font-body: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
}
.dk-panel, .dk-menu, .dk-button, .dk-hint { font: 13px/1.45 var(--dk-font-body); color: var(--dk-ink); }
.dk-panel {
  position: fixed; z-index: 20;
  top: calc(12px + env(safe-area-inset-top, 0px)); left: 12px;
  width: min(250px, calc(100vw - 24px));
  background: var(--dk-panel); border: 1px solid var(--dk-edge); border-radius: 8px;
  backdrop-filter: blur(6px);
}
.dk-panel > summary {
  list-style: none; cursor: pointer; padding: 10px 14px;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  font: 600 14px/1 var(--dk-font-label); letter-spacing: 0.06em; text-transform: uppercase;
}
.dk-panel > summary::-webkit-details-marker { display: none; }
.dk-panel > summary small { font: 500 11px/1 var(--dk-font-label); color: var(--dk-muted); letter-spacing: 0.08em; }
.dk-panel[open] > summary small::after { content: 'hide'; }
.dk-panel:not([open]) > summary small::after { content: 'show'; }
.dk-body { display: grid; gap: 4px; padding: 0 14px 14px; }
.dk-body h2 { margin: 10px 0 2px; font: 600 11px/1 var(--dk-font-label); text-transform: uppercase; letter-spacing: 0.12em; color: var(--dk-muted); }
.dk-body label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.dk-body input[type=checkbox], .dk-body input[type=range] { accent-color: var(--dk-accent); }
.dk-body input[type=range] { width: 100%; }
.dk-body select { width: 100%; padding: 5px 6px; border-radius: 6px; border: 1px solid var(--dk-edge); background: transparent; color: var(--dk-ink); font: inherit; }
.dk-body select option { color: #111; }
.dk-value { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--dk-muted); }
.dk-parts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
.dk-panel button, .dk-menu button {
  margin-top: 6px; padding: 7px 10px; border: 0; border-radius: 6px;
  background: var(--dk-accent); color: var(--dk-accent-ink);
  font: 600 12px/1 var(--dk-font-label); letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
}
.dk-panel button.dk-quiet { background: transparent; color: var(--dk-ink); border: 1px solid var(--dk-edge); }
.dk-panel :focus-visible, .dk-menu :focus-visible, .dk-button:focus-visible { outline: 2px solid var(--dk-accent); outline-offset: 2px; }
.dk-hint {
  position: fixed; z-index: 20; left: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  width: fit-content; max-width: calc(100vw - 24px); padding: 6px 10px;
  background: var(--dk-panel); border-radius: 6px; color: var(--dk-muted); font-size: 12px;
}
.dk-button {
  position: fixed; z-index: 30; top: calc(10px + env(safe-area-inset-top, 0px)); right: 10px;
  padding: 5px 8px; border-radius: 6px; border: 1px solid var(--dk-edge);
  background: var(--dk-panel); color: var(--dk-muted); cursor: pointer;
  font: 600 11px/1 var(--dk-font-label); letter-spacing: 0.14em;
}
.dk-button[aria-expanded="true"] { color: var(--dk-ink); border-color: var(--dk-accent); }
.dk-menu {
  position: fixed; z-index: 30; top: calc(40px + env(safe-area-inset-top, 0px)); right: 10px;
  width: min(260px, calc(100vw - 20px)); padding: 10px;
  background: var(--dk-panel); border: 1px solid var(--dk-edge); border-radius: 8px; backdrop-filter: blur(6px);
}
.dk-menu h2 { margin: 2px 4px 6px; font: 600 11px/1 var(--dk-font-label); letter-spacing: 0.12em; text-transform: uppercase; color: var(--dk-muted); }
.dk-menu button { display: grid; gap: 4px; width: 100%; margin: 0; padding: 9px 10px; text-align: left; }
.dk-menu button span { font: 400 12px/1.35 var(--dk-font-body); text-transform: none; letter-spacing: 0; opacity: 0.8; }
.dk-panel [hidden], .dk-menu[hidden] { display: none !important; }
.dk-shot .dk-panel, .dk-shot .dk-hint, .dk-shot .dk-button, .dk-shot .dk-menu { display: none !important; }
`;

let injected = false;
export function injectDevKitStyles() {
  if (injected) return;
  injected = true;
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600&family=IBM+Plex+Sans:wght@400;500&display=swap';
  document.head.append(fonts);
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
}
