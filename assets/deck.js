/* ============================================================
   deck.js — presentation viewer
   Usage: deck.html?p=<presentation-folder>#<slide-number>

   Self-bootstrapping: loaded on its own as a single <script>, it
   injects the stylesheets + fonts, loads its dependencies
   (markdown-it, highlight.js, md.js) and builds the viewer chrome.
   If the page already provides those (legacy full HTML), it detects
   them and skips the bootstrap.

   Optional configuration, before including the script:
     window.MDECK = {
       root: "presentations/",   // presentations folder
       home: "index.html",       // home page (H key, links)
       author: "Jane Doe",       // signature on the first/last slide
       monogram: "JD",           // signature monogram (default: initials)
       languages: ["powershell"],// extra highlight.js language files to load
       strings: { ... }          // UI text overrides (see STR below)
     }
   ============================================================ */

(function () {
  "use strict";

  /* base URL of the engine assets — next to this script, whether local
     or on a CDN; derived from deck.js's own src */
  const SELF = (document.currentScript && document.currentScript.src) || "";
  const ASSETS = SELF.replace(/[^/]*$/, "");
  const VENDOR = ASSETS + "vendor/";

  /* default engine fonts (Google Fonts family spec) */
  const DEFAULT_FONTS =
    "Archivo:wght@700;800&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600";

  const CFG = Object.assign(
    { root: "presentations/", home: "index.html", author: null, monogram: null, languages: [] },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

  /* ---------- per-presentation theming (presentation.json → "theme") ----------
     Overrides the :root CSS variables without touching the engine:
       "theme": {
         "colors":      { "ultra": "#c0392b", "gold": "#e0a800", "bone": "#faf7f0" },
         "fonts":       { "display": "Fraunces", "sans": "Inter", "mono": "JetBrains Mono" },
         "googleFonts": "Fraunces:wght@700;900&family=Inter:wght@400;600"
       }
     Keys in "colors"/"fonts" map directly to --<key> (see style.css).
     We inject a <style>:root{…}</style>, so the html.dark rules in style.css
     stay more specific and the dark theme keeps working. */
  function applyTheme(theme) {
    if (!theme || typeof theme !== "object") return;
    if (theme.googleFonts) injectFonts(theme.googleFonts);
    const fallback = {
      sans: ", system-ui, sans-serif",
      display: ", system-ui, sans-serif",
      mono: ", monospace",
    };
    const decls = [];
    for (const [k, v] of Object.entries(theme.colors || {}))
      if (typeof v === "string") decls.push("--" + k + ":" + v);
    for (const [k, v] of Object.entries(theme.fonts || {}))
      if (typeof v === "string")
        decls.push(
          "--" + k + ":" + (/[,"]/.test(v) ? v : '"' + v + '"' + (fallback[k] || ""))
        );
    if (!decls.length) return;
    const style = document.createElement("style");
    style.textContent = ":root{" + decls.join(";") + "}";
    document.head.appendChild(style);
  }

  /* Per-deck/slide accent: a palette name (data-accent) OR a free value
     (#hex, rgb(), hsl(), var(...)) applied straight to --a. */
  function setAccent(el, value) {
    if (!value) return;
    if (value.charAt(0) === "#" || /^(rgb|hsl|var\()/i.test(value))
      el.style.setProperty("--a", value);
    else el.dataset.accent = value;
  }

  /* UI strings — English defaults, overridable via window.MDECK.strings
     ({id}, {path}, {file} are replaced at render time) */
  const STR = Object.assign(
    {
      backToList: "Back to all presentations",
      titleSuffix: " — Slides",
      chipDefault: "Presentation",
      homeTitle: "Back to the library",
      navPrev: "Previous slide (←)",
      navNext: "Next slide (→)",
      navOverview: "Overview (G)",
      navTheme: "Dark/light theme (D)",
      navPdf: "Export to PDF (P)",
      navFull: "Fullscreen (F)",
      noDeckTitle: "No presentation specified",
      noDeckBody:
        "Open this viewer with the <code style='display:inline;padding:2px 8px'>?p=presentation-name</code> parameter, for example:",
      loadErrorTitle: "Couldn't load the presentation “{id}”",
      fileProtocolLines: [
        "The page was opened directly from a file (file://), so the browser blocks loading the slides.",
        "Start a local server in the project folder:",
        "$python -m http.server 8080",
        "then open <strong>http://localhost:8080</strong>.",
      ],
      checkFolder:
        "Check that the folder <strong>{path}</strong> exists and contains a <strong>presentation.json</strong> file.",
      missingSlideTitle: "Missing slide",
      missingSlideBody: "Couldn't load the file <strong>{file}</strong> from {path}",
    },
    CFG.strings || {}
  );

  const DESIGN_W = 1280, DESIGN_H = 720;

  /* DOM refs — assigned in init(), once the chrome exists */
  let stage, progress, counter, chipTitle, overview, errorBox;

  let slides = [];     // the .slide elements
  let cur = 0;
  let hudTimer = null;

  /* ---------- errors ---------- */
  function showError(title, lines) {
    errorBox.innerHTML =
      '<div class="error-panel"><h2>' + title + "</h2>" +
      lines.map((l) => (l.startsWith("$") ? "<code>" + l.slice(1) + "</code>" : "<p>" + l + "</p>")).join("") +
      '<p><a href="' + CFG.home + '" style="color:var(--teal)">&larr; ' + STR.backToList + "</a></p></div>";
    errorBox.classList.add("visible");
  }

  /* ---------- stage scaling ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H) * 0.96;
    stage.style.transform = "scale(" + s + ")";
  }

  /* ---------- navigation ---------- */
  function show(i, instant) {
    if (!slides.length) return;
    cur = Math.max(0, Math.min(i, slides.length - 1));
    slides.forEach((el, j) => el.classList.toggle("current", j === cur));
    progress.style.width = ((cur + 1) / slides.length) * 100 + "%";
    counter.innerHTML = "<b>" + (cur + 1) + "</b> / " + slides.length;
    if (!instant) history.replaceState(null, "", "#" + (cur + 1));
  }

  const next = () => show(cur + 1);
  const prev = () => show(cur - 1);

  /* ---------- auto-hiding HUD ---------- */
  function pokeHud() {
    document.body.classList.add("hud-visible");
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => document.body.classList.remove("hud-visible"), 2600);
  }

  /* ---------- overview mode ---------- */
  function openOverview() {
    const grid = document.createElement("div");
    grid.className = "ov-grid";
    slides.forEach((el, i) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb" + (i === cur ? " active" : "");
      const mini = document.createElement("div");
      mini.className = "mini";
      mini.appendChild(el.cloneNode(true));
      thumb.appendChild(mini);
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = i + 1;
      thumb.appendChild(num);
      thumb.addEventListener("click", () => { closeOverview(); show(i); });
      grid.appendChild(thumb);
    });
    overview.innerHTML = "";
    overview.appendChild(grid);
    document.body.classList.add("overview");
    requestAnimationFrame(() => {
      // scale the miniatures to the thumb's real width
      grid.querySelectorAll(".thumb").forEach((t) => {
        const s = t.clientWidth / DESIGN_W;
        t.querySelector(".mini").style.transform = "scale(" + s + ")";
      });
      const active = grid.querySelector(".thumb.active");
      if (active) active.scrollIntoView({ block: "center" });
    });
  }

  function closeOverview() { document.body.classList.remove("overview"); }
  function toggleOverview() {
    document.body.classList.contains("overview") ? closeOverview() : openOverview();
  }

  /* ---------- fullscreen ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  /* ---------- dark / light theme ---------- */
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("mdeck-theme", dark ? "dark" : "light"); } catch (e) {}
  }

  /* ---------- PDF export (native Print to PDF) ----------
     All slides are already in the DOM; @media print in deck.css turns
     them into edge-to-edge 16:9 pages. Here we just make sure
     mermaid/KaTeX have finished rendering before opening the dialog. */
  let enhanceDone = Promise.resolve();
  async function printDeck() {
    closeOverview();
    try { await enhanceDone; } catch (e) {}
    // one frame so the browser can lay out freshly rendered diagrams
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.print();
  }

  /* ---------- lazy assets (mermaid, katex) ---------- */
  const loaded = {};
  function loadScript(src) {
    return (loaded[src] =
      loaded[src] ||
      new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error("load " + src));
        document.head.appendChild(s);
      }));
  }
  function loadCss(href) {
    if (loaded[href]) return;
    loaded[href] = true;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  function injectFonts(spec) {
    loadCss("https://fonts.googleapis.com/css2?family=" + spec + "&display=swap");
  }

  /* Render the diagrams and formulas in the slides, loading the vendored
     libraries on demand. Non-blocking: runs in the background. */
  async function enhance() {
    const dark = document.documentElement.classList.contains("dark");

    // KaTeX — only if md.js produced .math elements (formulas extracted from $…$)
    const maths = stage.querySelectorAll(".math");
    if (maths.length) {
      loadCss(VENDOR + "katex/katex.min.css");
      try {
        await loadScript(VENDOR + "katex/katex.min.js");
        maths.forEach((el) => {
          try {
            window.katex.render(el.textContent, el, {
              displayMode: el.classList.contains("math-display"),
              throwOnError: false,
            });
          } catch (e) { /* keep the raw source if the formula is invalid */ }
        });
      } catch (e) { /* no math if the library is missing */ }
    }

    // Mermaid — only if there's at least one diagram
    if (stage.querySelector("pre.mermaid")) {
      try {
        await loadScript(VENDOR + "mermaid.min.js");
        window.mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "neutral",
          fontFamily: "inherit",
        });
        await window.mermaid.run({ nodes: stage.querySelectorAll("pre.mermaid") });
      } catch (e) { /* no diagrams if the library is missing */ }
    }
  }

  /* ---------- loading ---------- */
  async function load() {
    const id = new URLSearchParams(location.search).get("p");
    if (!id || /[^\w-]/.test(id)) {
      showError(STR.noDeckTitle, [
        STR.noDeckBody,
        "$deck.html?p=intro-sql",
      ]);
      return;
    }

    const base = CFG.root + id + "/";
    let meta;
    try {
      const r = await fetch(base + "presentation.json");
      if (!r.ok) throw new Error(r.status);
      meta = await r.json();
    } catch (err) {
      const isFile = location.protocol === "file:";
      showError(STR.loadErrorTitle.replace("{id}", id), isFile
        ? STR.fileProtocolLines
        : [STR.checkFolder.replace("{path}", CFG.root + id)]);
      return;
    }

    let sources;
    try {
      sources = await Promise.all(
        meta.slides.map((f) =>
          fetch(base + f).then((r) => {
            if (!r.ok) throw new Error(f);
            return r.text();
          })
        )
      );
    } catch (err) {
      showError(STR.missingSlideTitle, [
        STR.missingSlideBody.replace("{file}", err.message).replace("{path}", base),
      ]);
      return;
    }

    document.title = meta.title + STR.titleSuffix;
    chipTitle.textContent = meta.title;
    applyTheme(meta.theme);
    const deckAccent = meta.accent || "teal";

    sources.forEach((src) => {
      const { fm, html } = MD.parseSlide(src);
      const el = document.createElement("section");
      el.className = "slide layout-" + (fm.layout || "default");
      setAccent(el, fm.accent || deckAccent);
      el.innerHTML = html;
      // background image (layout: full-image) — relative to the presentation folder
      if (fm.image) {
        const url = /^(https?:|data:|\/)/.test(fm.image) ? fm.image : base + fm.image;
        el.style.setProperty("--slide-image", "url('" + url.replace(/'/g, "%27") + "')");
        el.classList.add("has-image");
      }
      stage.appendChild(el);
      slides.push(el);
    });

    // mermaid + KaTeX, loaded only if some slide actually uses them
    enhanceDone = enhance();

    // author signature (if configured) — only on the title and final slides
    if (CFG.author && slides.length) {
      const mono = CFG.monogram ||
        CFG.author.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
      const addSign = (el) => {
        const s = document.createElement("div");
        s.className = "sign";
        s.innerHTML = "<span class='monogram'></span><span></span>";
        s.firstChild.textContent = mono;
        s.lastChild.textContent = CFG.author;
        el.appendChild(s);
      };
      addSign(slides[0]);
      if (slides.length > 1) addSign(slides[slides.length - 1]);
    }

    fit();
    const n = parseInt(location.hash.slice(1), 10);
    show(!isNaN(n) ? n - 1 : 0, true);
    pokeHud();
  }

  /* ---------- viewer chrome (built when the page doesn't supply it) ---------- */
  function buildScaffold() {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div id="progress"></div>' +
        '<div id="stage-wrap"><div id="stage"></div></div>' +
        '<div id="hud">' +
          '<a class="chip" id="chip-home" href="' + CFG.home + '" title="' + STR.homeTitle + '">' +
            '<span class="dot"></span><span id="chip-title">' + STR.chipDefault + "</span></a>" +
          '<div class="controls">' +
            '<button id="btn-prev" title="' + STR.navPrev + '">&#8592;</button>' +
            '<span id="counter"></span>' +
            '<button id="btn-next" title="' + STR.navNext + '">&#8594;</button>' +
            '<button id="btn-grid" title="' + STR.navOverview + '">&#9638;</button>' +
            '<button id="btn-theme" title="' + STR.navTheme + '">&#9681;</button>' +
            '<button id="btn-pdf" title="' + STR.navPdf + '">&#x2913;</button>' +
            '<button id="btn-full" title="' + STR.navFull + '">&#x26F6;</button>' +
          "</div>" +
        "</div>" +
        '<div id="overview"></div>' +
        '<div id="deck-error"></div>'
    );
  }

  /* ---------- wiring (after the chrome exists) ---------- */
  function init() {
    stage = document.getElementById("stage");
    progress = document.getElementById("progress");
    counter = document.getElementById("counter");
    chipTitle = document.getElementById("chip-title");
    overview = document.getElementById("overview");
    errorBox = document.getElementById("deck-error");
    const chipHome = document.getElementById("chip-home");
    if (chipHome) chipHome.href = CFG.home;

    window.addEventListener("resize", fit);
    window.addEventListener("mousemove", pokeHud);

    /* keyboard */
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case " ": case "PageDown":
          e.preventDefault(); closeOverview(); next(); break;
        case "ArrowLeft": case "ArrowUp": case "PageUp":
          e.preventDefault(); closeOverview(); prev(); break;
        case "Home": e.preventDefault(); show(0); break;
        case "End":  e.preventDefault(); show(slides.length - 1); break;
        case "f": case "F": toggleFullscreen(); break;
        case "h": case "H": location.href = CFG.home; break;
        case "d": case "D": toggleTheme(); break;
        case "g": case "G": case "o": case "O": toggleOverview(); break;
        case "p": case "P": e.preventDefault(); printDeck(); break;
        case "Escape": closeOverview(); break;
      }
    });

    /* touch (swipe) */
    let touchX = null;
    window.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    window.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
      touchX = null;
    }, { passive: true });

    /* click on stage = forward */
    document.getElementById("stage-wrap").addEventListener("click", (e) => {
      if (e.target.closest("a, button, pre, code, table")) return;
      if (window.getSelection().toString()) return;
      next();
    });

    document.getElementById("btn-prev").addEventListener("click", (e) => { e.stopPropagation(); prev(); });
    document.getElementById("btn-next").addEventListener("click", (e) => { e.stopPropagation(); next(); });
    document.getElementById("btn-grid").addEventListener("click", (e) => { e.stopPropagation(); toggleOverview(); });
    document.getElementById("btn-theme").addEventListener("click", (e) => { e.stopPropagation(); toggleTheme(); });
    document.getElementById("btn-pdf").addEventListener("click", (e) => { e.stopPropagation(); printDeck(); });
    document.getElementById("btn-full").addEventListener("click", (e) => { e.stopPropagation(); toggleFullscreen(); });

    window.addEventListener("hashchange", () => {
      const n = parseInt(location.hash.slice(1), 10);
      if (!isNaN(n) && n - 1 !== cur) show(n - 1, true);
    });

    load();
  }

  /* ---------- bootstrap ----------
     Inject CSS/fonts and build the chrome only if the page didn't already
     provide them; load the parser/highlighter/adapter only if they aren't
     global yet. This keeps legacy full HTML pages working unchanged. */
  async function boot() {
    if (!document.getElementById("stage")) {
      injectFonts(DEFAULT_FONTS);
      loadCss(ASSETS + "style.css");
      loadCss(ASSETS + "deck.css");
      buildScaffold();
    }
    if (!window.MD) {
      await Promise.all([
        window.markdownit || loadScript(VENDOR + "markdown-it.min.js"),
        window.hljs || loadScript(VENDOR + "highlight.min.js"),
      ]);
      for (const lang of CFG.languages || []) {
        try { await loadScript(VENDOR + "languages/" + lang + ".min.js"); } catch (e) {}
      }
      await loadScript(ASSETS + "md.js");
    }
    init();
  }

  boot();
})();
