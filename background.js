// Toolbar icon toggles the extension; the state lives in storage so content scripts can follow it.
const DEFAULT_SETTINGS = { enabled: true };

async function isEnabled() {
  const { enabled } = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return enabled !== false;
}

async function updateIcon(enabled) {
  // Toolbar-sized images per scale; a single oversized path can be silently ignored by setIcon.
  const name = enabled ? 'continue' : 'continue_off';
  try {
    await chrome.action.setIcon({
      path: { 16: `icons/${name}_16.png`, 32: `icons/${name}_32.png` },
    });
    await chrome.action.setTitle({ title: `YouTube No Stop: ${enabled ? 'ON' : 'OFF'}` });
  } catch (err) {
    console.error('[YouTube No Stop] Icon update failed:', err);
  }
}

async function restoreIcon() {
  try {
    await updateIcon(await isEnabled());
  } catch (err) {
    console.error('[YouTube No Stop] Icon restore failed:', err);
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    const enabled = !(await isEnabled());
    await chrome.storage.local.set({ enabled });
    await updateIcon(enabled);
  } catch (err) {
    console.error('[YouTube No Stop] Toggle failed:', err);
  }
});

// Chrome resets the action icon to the manifest default whenever the extension is
// (re)enabled or its process restarts; those paths fire neither onInstalled nor onStartup,
// so re-sync on every service worker start as well.
restoreIcon();
chrome.runtime.onInstalled.addListener(restoreIcon);
chrome.runtime.onStartup.addListener(restoreIcon);
