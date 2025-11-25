// popup.js
const DEFAULT_SETTINGS = {
  sponsoredEnabled: true,
  liveEnabled: false
};

document.addEventListener("DOMContentLoaded", () => {
  const sponsoredToggle = document.getElementById("sponsoredToggle");
  const liveToggle = document.getElementById("liveToggle");

  // load current settings
  chrome.storage.sync.get(DEFAULT_SETTINGS, (res) => {
    sponsoredToggle.checked = !!res.sponsoredEnabled;
    liveToggle.checked = !!res.liveEnabled;
  });

  sponsoredToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ sponsoredEnabled: sponsoredToggle.checked });
  });

  liveToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ liveEnabled: liveToggle.checked });
  });
});
