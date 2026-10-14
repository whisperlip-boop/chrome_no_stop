// Fallback for when the prompt still appears: click "Yes" and resume playback.
(() => {
  'use strict';

  const LOG_PREFIX = '[YouTube No Stop]';
  const POLL_MS = 2000;
  const EVENT_CHECK_DELAYS_MS = [300, 1000, 2500];
  const RESUME_DELAY_MS = 500;
  const CLICK_COOLDOWN_MS = 3000;
  // User-opened confirm dialogs (e.g. "Remove from playlist?") follow a fresh input;
  // the idle prompt only shows after a long idle period, so this separates the two.
  const MIN_IDLE_MS = 10 * 1000;

  // yt-confirm-dialog-renderer is YouTube's generic confirm dialog. The idle prompt is the
  // only one with a single "Yes" button, so a visible cancel button rules a dialog out
  // without depending on the (localized) text.
  const TARGETS = [
    {
      dialog: 'ytd-popup-container yt-confirm-dialog-renderer',
      buttons: ['#confirm-button button', '#confirm-button'],
      cancel: '#cancel-button',
    },
    {
      dialog: 'ytmusic-popup-container ytmusic-you-there-renderer',
      buttons: ['button'],
      cancel: null,
    },
  ];

  // Only the main player; feed/preview <video> elements sit paused forever.
  const PLAYER_VIDEO_SELECTORS = ['#movie_player video', 'ytmusic-player video'];

  let enabled = true;
  let lastInputAt = Date.now();
  let lastClickAt = 0;

  function setEnabled(value) {
    enabled = value !== false;
    document.documentElement.dataset.ytNoStopEnabled = String(enabled);
  }

  function getVideo() {
    for (const selector of PLAYER_VIDEO_SELECTORS) {
      const video = document.querySelector(selector);
      if (video) return video;
    }
    return null;
  }

  function hasVisibleCancel(dialog, selector) {
    if (!selector) return false;
    const cancel = dialog.querySelector(selector);
    return cancel !== null && cancel.checkVisibility();
  }

  function findConfirmButton() {
    for (const target of TARGETS) {
      for (const dialog of document.querySelectorAll(target.dialog)) {
        if (!dialog.checkVisibility()) continue;
        if (hasVisibleCancel(dialog, target.cancel)) continue;
        for (const selector of target.buttons) {
          const button = dialog.querySelector(selector);
          if (button) return button;
        }
      }
    }
    return null;
  }

  function resumeIfPaused() {
    const video = getVideo();
    if (!video?.paused) return;
    video.play().catch((err) => console.warn(LOG_PREFIX, 'Resume failed:', err));
  }

  function check() {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastClickAt < CLICK_COOLDOWN_MS) return;
    if (now - lastInputAt < MIN_IDLE_MS) return;

    const video = getVideo();
    if (!video?.paused) return;

    const button = findConfirmButton();
    if (!button) return;

    lastClickAt = now;
    button.click();
    console.info(LOG_PREFIX, 'Confirmed "Continue watching?" dialog.');
    setTimeout(resumeIfPaused, RESUME_DELAY_MS);
  }

  function scheduleChecks() {
    // Single timeouts from events avoid Chrome's intensive throttling of polling in hidden tabs.
    for (const delay of EVENT_CHECK_DELAYS_MS) setTimeout(check, delay);
  }

  // mousemove is excluded: hovering over an unfocused, visible YouTube window would reset the idle timer.
  for (const type of ['mousedown', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(
      type,
      (e) => {
        if (e.isTrusted) lastInputAt = Date.now();
      },
      { capture: true, passive: true },
    );
  }

  chrome.storage.local
    .get({ enabled: true })
    .then((settings) => setEnabled(settings.enabled))
    .catch((err) => console.warn(LOG_PREFIX, 'Failed to load settings:', err));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'enabled' in changes) {
      setEnabled(changes.enabled.newValue);
      console.info(LOG_PREFIX, enabled ? 'Enabled.' : 'Disabled.');
    }
  });

  // Media events don't bubble, so listen in the capture phase.
  document.addEventListener('pause', scheduleChecks, true);
  document.addEventListener('yt-popup-opened', scheduleChecks, true);
  setInterval(check, POLL_MS);
})();
