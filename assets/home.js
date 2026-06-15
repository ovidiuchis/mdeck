/* ============================================================
   home.js — home page: lists the presentations
   Self-bootstrapping: loaded on its own as a single <script>, it
   injects the stylesheet + fonts, so a host page only needs to
   provide a <main id="decks"></main> and its own custom markup.
   If the page already links style.css, the injection is skipped.

   Optional configuration, before including the script:
     window.MDECK = {
       root: "presentations/",   // presentations folder
       deck: "deck.html",        // viewer page
       strings: { ... }          // UI text overrides (see STR below)
     }
   ============================================================ */

(function () {
  "use strict";

  /* base URL of the engine assets — next to this script (local or CDN) */
  const SELF = (document.currentScript && document.currentScript.src) || "";
  const ASSETS = SELF.replace(/[^/]*$/, "");
  const DEFAULT_FONTS =
    "Archivo:wght@700;800&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600";

  const CFG = Object.assign(
    { root: "presentations/", deck: "deck.html" },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

  /* inject the engine stylesheet + fonts unless the page already links them */
  function injectCss(href) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  if (ASSETS && !document.querySelector('link[href$="assets/style.css"]')) {
    injectCss(ASSETS + "style.css");
    injectCss("https://fonts.googleapis.com/css2?family=" + DEFAULT_FONTS + "&display=swap");
  }

  /* UI strings — English defaults, overridable via window.MDECK.strings
     ({path} is replaced at render time) */
  const STR = Object.assign(
    {
      cardMeta: "Presentation &middot; {n} slides",
      open: "Open",
      listErrorTitle: "Couldn't load the presentation list",
      fileProtocol:
        "<p>The page was opened directly from a file (file://), so the browser blocks loading data. Start a local server in the project folder:</p>" +
        "<code>python -m http.server 8080</code>" +
        "<p>then open <strong>http://localhost:8080</strong>.</p>",
      checkIndex: "<p>Check that the file <strong>{path}</strong> exists.</p>",
    },
    CFG.strings || {}
  );

  /* ---------- dark / light theme ---------- */
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("mdeck-theme", dark ? "dark" : "light"); } catch (e) {}
  }
  const themeBtn = document.getElementById("btn-theme");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  window.addEventListener("keydown", (e) => {
    if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleTheme();
  });

  /* ---------- presentation list ---------- */
  (async function () {
    const root = document.getElementById("decks");

    function fail(isFile) {
      root.innerHTML =
        '<div class="error-panel" style="grid-column:1/-1">' +
        "<h2>" + STR.listErrorTitle + "</h2>" +
        (isFile ? STR.fileProtocol : STR.checkIndex.replace("{path}", CFG.root + "index.json")) +
        "</div>";
    }

    let list;
    try {
      list = await (await fetch(CFG.root + "index.json")).json();
    } catch (e) {
      fail(location.protocol === "file:");
      return;
    }

    /* normalize: the legacy flat list becomes a collection without a title */
    const collections = Array.isArray(list.collections) ? list.collections.slice() : [];
    if (Array.isArray(list.presentations) && list.presentations.length)
      collections.push({ presentations: list.presentations });

    /* fetch every presentation's metadata once */
    const ids = [...new Set(collections.flatMap((c) => c.presentations || []))];
    const metas = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          metas[id] = await (await fetch(CFG.root + id + "/presentation.json")).json();
        } catch (e) {}
      })
    );

    /* Load each deck's Google Fonts once, so its card can render in the deck's
       own typeface. */
    const loadedFonts = new Set();
    function loadFonts(spec) {
      if (!spec || loadedFonts.has(spec)) return;
      loadedFonts.add(spec);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap";
      document.head.appendChild(link);
    }

    const fontFallback = {
      sans: ", system-ui, sans-serif",
      display: ", system-ui, sans-serif",
      mono: ", monospace",
    };

    /* Reflect each deck's theme on its card: free-form or named accent, the
       theme's primary/gold, and its fonts — so the card's stripe, label, title
       and "open" link carry the deck's identity. We deliberately do NOT override
       paper/bone/ink here, so the home page's dark mode keeps working. */
    function applyCardTheme(el, meta) {
      const accent = meta.accent;
      if (accent && (accent.charAt(0) === "#" || /^(rgb|hsl|var\()/i.test(accent)))
        el.style.setProperty("--a", accent);
      else el.dataset.accent = accent || "teal";
      const theme = meta.theme || {};
      const colors = theme.colors || {};
      if (colors.ultra) el.style.setProperty("--ultra", colors.ultra);
      if (colors.gold) el.style.setProperty("--gold", colors.gold);
      loadFonts(theme.googleFonts);
      for (const [k, v] of Object.entries(theme.fonts || {}))
        if (typeof v === "string")
          el.style.setProperty(
            "--" + k,
            /[,"]/.test(v) ? v : '"' + v + '"' + (fontFallback[k] || "")
          );
    }

    function card(id, meta) {
      const a = document.createElement("a");
      a.className = "deck-card";
      a.href = CFG.deck + "?p=" + encodeURIComponent(id);
      applyCardTheme(a, meta);
      a.innerHTML =
        '<div class="meta">' + STR.cardMeta.replace("{n}", meta.slides.length) + "</div>" +
        "<h2>" + meta.title + "</h2>" +
        "<p>" + (meta.description || meta.subtitle || "") + "</p>" +
        '<div class="foot"><div class="tags">' +
        (meta.tags || []).map((t) => '<span class="tag">' + t + "</span>").join("") +
        '</div><span class="go">' + STR.open + " &rarr;</span></div>";
      return a;
    }

    const grouped = collections.some((c) => c.title);
    if (grouped) {
      root.classList.remove("decks");
      root.classList.add("collections");
    }

    for (const col of collections) {
      const items = (col.presentations || []).filter((id) => metas[id]);
      if (!items.length) continue;

      let grid = root;
      if (grouped) {
        const sec = document.createElement("section");
        sec.className = "collection";
        sec.innerHTML =
          (col.title ? '<h2 class="collection-title">' + col.title + "</h2>" : "") +
          (col.description ? '<p class="collection-desc">' + col.description + "</p>" : "");
        grid = document.createElement("div");
        grid.className = "decks";
        sec.appendChild(grid);
        root.appendChild(sec);
      }
      for (const id of items) grid.appendChild(card(id, metas[id]));
    }
  })();
})();
