// content.js
(() => {
  const VIDEO_SELECTORS = [
    '[data-e2e*="feed-video"]',
    '[data-e2e*="browse-video"]',
    '[data-e2e*="video-card"]',
    '[data-e2e*="search-card"]'
  ].join(",");

  const SPONSORED_WORDS = ["sponsored", "promoted"];

  const log = (...args) =>
    console.log(
      "%c[TikTok-Skipper]",
      "color:#00c4ff;font-weight:bold",
      ...args
    );

  const isEl = (n) => n && n.nodeType === Node.ELEMENT_NODE;

  // find all cards in DOM order
  const getCards = () => Array.from(document.querySelectorAll(VIDEO_SELECTORS));

  const goToNextCard = (currentCard) => {
    const cards = getCards();
    const idx = cards.indexOf(currentCard);

    if (idx === -1) {
      log("Could not find current card index, falling back to window scroll.");
      window.scrollBy({ top: window.innerHeight * 0.9, left: 0, behavior: "smooth" });
      return;
    }

    const next = cards[idx + 1] || cards[idx - 1];
    if (!next) {
      log("No next/previous card found, falling back to window scroll.");
      window.scrollBy({ top: window.innerHeight * 0.9, left: 0, behavior: "smooth" });
      return;
    }

    log("→ Scrolling to next video card.", { fromIndex: idx, toIndex: cards.indexOf(next) });

    // important: use scrollIntoView so we beat TikTok snapping
    next.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  const isSponsoredCard = (card) => {
    const text = (card.innerText || card.textContent || "")
      .trim()
      .toLowerCase();

    if (!text) return false;
    return SPONSORED_WORDS.some((w) => text.includes(w));
  };

  const inspectCard = (card) => {
    if (!isEl(card)) return;
    if (card.dataset.skipChecked === "1") return;

    const sponsored = isSponsoredCard(card);
    card.dataset.skipChecked = "1";

    if (sponsored) {
      card.dataset.skipSponsored = "1";
      log(
        "%cVideo status: SPONSORED → skipping",
        "font-weight:bold;color:red",
        card
      );
      setTimeout(() => goToNextCard(card), 80);
    } else {
      log(
        "%cVideo status: Not sponsored",
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

  const init = () => {
    log("Initializing…");

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

    // periodic safety net
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

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init, { once: true });
  }
})();
