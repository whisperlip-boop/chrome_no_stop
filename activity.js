// Runs in the page (MAIN) world: YouTube judges idleness from window._lact,
// so refreshing it keeps the "Continue watching?" prompt from being scheduled at all.
(() => {
  'use strict';

  const REFRESH_MS = 60 * 1000;

  setInterval(() => {
    // MAIN world has no chrome.storage; content.js mirrors the on/off state onto this DOM attribute.
    if (document.documentElement.dataset.ytNoStopEnabled === 'false') return;
    window._lact = Date.now();
  }, REFRESH_MS);
})();
