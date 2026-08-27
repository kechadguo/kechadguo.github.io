(() => {
  const root = document.documentElement;
  root.dataset.uiVersion = 'v3';
  root.dataset.v3Ready = 'true';
  const storedTheme = (() => {
    try { return localStorage.getItem('theme') || 'light'; } catch (e) { return 'light'; }
  })();
  if (storedTheme === 'dark' || storedTheme === 'night') root.dataset.theme = 'dark';
  else root.dataset.theme = 'light';
  window.__UI_V3__ = true;
  window.__UI_V2__ = false;
})();
