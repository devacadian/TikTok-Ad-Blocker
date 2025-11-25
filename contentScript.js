// contentScript.js (updated to support Sponsored + Live toggles)
(() => {
  const VIDEO_SELECTORS = [
    '[data-e2e*="feed-video"]',
    '[data-e2e*="browse-video"]',
    '[data-e2e*="video-card"]',
    '[data-e2e*="search-card"]'
  ].join(",");

  const SPONSORED_WORDS = ["sponsored", "promoted"];
  const LIVE_WORDS = [" live", "live now"];

  const DEFAULT_SETTINGS = {
    sponsoredEnabled: true,
    liveEnabled: false
  };

  const settings = {
    sponsoredEnabled: DEFAULT_SETTINGS.sponsoredEnabled,
    liveEnabled: DEFAULT_SETTINGS.liveEnabled
  };

  const log = (...args) =>
    console.log(
      "%c[TikTok-Skipper]",
      "color:#00c4ff;font-weight:bold",
      ...args
    );

  const isEl = (n) => n && n.nodeType === Node.ELEMENT_NODE;

  const getCards = () => Array.from(document.querySelectorAll(VIDEO_SELECTORS));

  const goToNextCard = (currentCard) => {
    const cards = getCards();
    const idx = cards.indexOf(currentCard);

    if (idx === -1) {
      log("Could not find current card index, falling back to window scroll.");
      window.scrollBy({
        top: window.innerHeight * 0.9,
        left: 0,
        behavior: "smooth"
      });
      return;
    }

    const next = cards[idx + 1] || cards[idx - 1];
    if (!next) {
      log("No next/previous card found, falling back to window scroll.");
      window.scrollBy({
        top: window.innerHeight * 0.9,
        left: 0,
        behavior: "smooth"
      });
      return;
    }

    log("→ Scrolling to next video card.", {
      fromIndex: idx,
      toIndex: cards.indexOf(next)
    });

    next.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  const getCardText = (card) =>
    (card.innerText || card.textContent || "").trim().toLowerCase();

  const isSponsoredCard = (card) => {
    const text = getCardText(card);
    if (!text) return false;
    return SPONSORED_WORDS.some((w) => text.includes(w));
  };

  const isLiveCard = (card) => {
    // heuristic: text + any live-related data-e2e
    const text = getCardText(card);
    if (!text) return false;

    if (card.querySelector('[data-e2e*="live"]')) return true;
    return LIVE_WORDS.some((w) => text.includes(w));
  };

  const inspectCard = (card) => {
    if (!isEl(card)) return;
    if (card.dataset.skipChecked === "1") return;

    const sponsored = settings.sponsoredEnabled && isSponsoredCard(card);
    const live = settings.liveEnabled && isLiveCard(card);

    card.dataset.skipChecked = "1";

    if (sponsored || live) {
      card.dataset.skipBlocked = "1";
      const reason = sponsored && live
        ? "SPONSORED + LIVE"
        : sponsored
        ? "SPONSORED"
        : "LIVE";

      log(
        `%cVideo status: ${reason} → skipping`,
        "font-weight:bold;color:red",
        card
      );
      setTimeout(() => goToNextCard(card), 80);
    } else {
      log(
        "%cVideo status: Allowed (not sponsored/live or feature disabled)",
        "font-weight:bold;color:green",
        card
      );
    }
  };

  const attachObserverToExistingCards = (observer) => {
    const cards = document.querySelectorAll(VIDEO_SELECTORS);
    cards.forEach((c) => observer.observe(c));
    log("Attached observer to", cards.length, "existing video cards.");
  };

  const setupObservers = () => {
    log("Initializing observers…");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          if (!entry.isIntersecting) return;
          if (card.dataset.skipChecked === "1") return;
          inspectCard(card);
        });
      },
      {
        threshold: 0.6
      }
    );

    attachObserverToExistingCards(io);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!isEl(n)) return;

          if (n.matches && n.matches(VIDEO_SELECTORS)) {
            log("New video card detected (root).");
            io.observe(n);
          }

          const nestedCards = n.querySelectorAll
            ? n.querySelectorAll(VIDEO_SELECTORS)
            : [];
          nestedCards.forEach((c) => {
            log("New video card detected (nested).");
            io.observe(c);
          });
        });
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      const cards = document.querySelectorAll(VIDEO_SELECTORS);
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const inView =
          rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
        if (inView && card.dataset.skipChecked !== "1") {
          inspectCard(card);
        }
      });
    }, 2000);

    log("Extension active ✔");
  };

  const loadSettings = (cb) => {
    if (!chrome?.storage?.sync) {
      log("chrome.storage.sync not available, using defaults.");
      cb();
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (res) => {
      settings.sponsoredEnabled = !!res.sponsoredEnabled;
      settings.liveEnabled = !!res.liveEnabled;

      log("Loaded settings:", {
        sponsoredEnabled: settings.sponsoredEnabled,
        liveEnabled: settings.liveEnabled
      });

      cb();
    });
  };

  // react live to popup changes
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;

      if (changes.sponsoredEnabled) {
        settings.sponsoredEnabled = !!changes.sponsoredEnabled.newValue;
        log("Sponsored toggle changed:", settings.sponsoredEnabled);
        // allow re-checking if needed
        document
          .querySelectorAll(`[data-skip-checked="1"]`)
          .forEach((el) => delete el.dataset.skipChecked);
      }

      if (changes.liveEnabled) {
        settings.liveEnabled = !!changes.liveEnabled.newValue;
        log("Live toggle changed:", settings.liveEnabled);
        document
          .querySelectorAll(`[data-skip-checked="1"]`)
          .forEach((el) => delete el.dataset.skipChecked);
      }
    });
  }

  const boot = () => {
    loadSettings(() => {
      if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
      ) {
        setupObservers();
      } else {
        window.addEventListener("DOMContentLoaded", setupObservers, {
          once: true
        });
      }
    });
  };

  boot();
})();
