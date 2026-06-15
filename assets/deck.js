/* ============================================================
   deck.js — presentation viewer
   Usage: deck.html?p=<presentation-folder>#<slide-number>

   Optional configuration, before including the script:
     window.MDECK = {
       root: "presentations/",   // presentations folder
       home: "index.html",       // home page (H key, links)
       author: "Jane Doe",       // signature on the first/last slide
       monogram: "JD",           // signature monogram (default: initials)
       strings: { ... }          // UI text overrides (see STR below)
     }
   ============================================================ */

(function () {
  "use strict";

  /* unde stau vendorele (mermaid/katex) — lângă acest script, fie local,
     fie pe CDN; derivat din src-ul lui deck.js */
  const SELF = (document.currentScript && document.currentScript.src) || "";
  const VENDOR = SELF.replace(/[^/]*$/, "") + "vendor/";

  const CFG = Object.assign(
    { root: "presentations/", home: "index.html", author: null, monogram: null },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

  /* ---------- theming per prezentare (presentation.json → "theme") ----------
     Suprascrie variabilele CSS din :root fără a atinge motorul:
       "theme": {
         "colors":      { "ultra": "#c0392b", "gold": "#e0a800", "bone": "#faf7f0" },
         "fonts":       { "display": "Fraunces", "sans": "Inter", "mono": "JetBrains Mono" },
         "googleFonts": "Fraunces:wght@700;900&family=Inter:wght@400;600"
       }
     Cheile din "colors"/"fonts" se mapează direct la --<cheie> (vezi style.css).
     Injectăm un <style>:root{…}</style>, deci regulile html.dark din style.css
     rămân mai specifice și tema închisă continuă să funcţioneze. */
  function applyTheme(theme) {
    if (!theme || typeof theme !== "object") return;
    if (theme.googleFonts) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=" + theme.googleFonts + "&display=swap";
      document.head.appendChild(link);
    }
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

  /* Accent per deck/slide: nume din paletă (data-accent) SAU valoare liberă
     (#hex, rgb(), hsl(), var(...)) aplicată direct pe --a. */
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

  const stage = document.getElementById("stage");
  const progress = document.getElementById("progress");
  const counter = document.getElementById("counter");
  const chipTitle = document.getElementById("chip-title");
  const overview = document.getElementById("overview");
  const errorBox = document.getElementById("deck-error");
  document.getElementById("chip-home").href = CFG.home;

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
  window.addEventListener("resize", fit);

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
  window.addEventListener("mousemove", pokeHud);

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

  /* ---------- keyboard ---------- */
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
      case "Escape": closeOverview(); break;
    }
  });

  /* ---------- touch (swipe) ---------- */
  let touchX = null;
  window.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    touchX = null;
  }, { passive: true });

  /* ---------- click on stage = forward ---------- */
  document.getElementById("stage-wrap").addEventListener("click", (e) => {
    if (e.target.closest("a, button, pre, code, table")) return;
    if (window.getSelection().toString()) return;
    next();
  });

  document.getElementById("btn-prev").addEventListener("click", (e) => { e.stopPropagation(); prev(); });
  document.getElementById("btn-next").addEventListener("click", (e) => { e.stopPropagation(); next(); });
  document.getElementById("btn-grid").addEventListener("click", (e) => { e.stopPropagation(); toggleOverview(); });
  document.getElementById("btn-theme").addEventListener("click", (e) => { e.stopPropagation(); toggleTheme(); });
  document.getElementById("btn-full").addEventListener("click", (e) => { e.stopPropagation(); toggleFullscreen(); });

  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (!isNaN(n) && n - 1 !== cur) show(n - 1, true);
  });

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

  /* Randează diagramele și formulele din slide-uri, încărcând librăriile
     vendorizate la cerere. Nu blochează afișarea: rulează în fundal. */
  async function enhance() {
    const dark = document.documentElement.classList.contains("dark");

    // KaTeX — doar dacă md.js a produs elemente .math (formule extrase din $…$)
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
          } catch (e) { /* lasă sursa brută dacă formula e invalidă */ }
        });
      } catch (e) { /* fără math dacă lipsește librăria */ }
    }

    // Mermaid — doar dacă există vreo diagramă
    if (stage.querySelector("pre.mermaid")) {
      try {
        await loadScript(VENDOR + "mermaid.min.js");
        window.mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "neutral",
          fontFamily: "inherit",
        });
        await window.mermaid.run({ nodes: stage.querySelectorAll("pre.mermaid") });
      } catch (e) { /* fără diagrame dacă lipsește librăria */ }
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
      // imagine de fundal (layout: full-image) — relativă la folderul prezentării
      if (fm.image) {
        const url = /^(https?:|data:|\/)/.test(fm.image) ? fm.image : base + fm.image;
        el.style.setProperty("--slide-image", "url('" + url.replace(/'/g, "%27") + "')");
        el.classList.add("has-image");
      }
      stage.appendChild(el);
      slides.push(el);
    });

    // mermaid + KaTeX, încărcate doar dacă vreun slide chiar le folosește
    enhance();

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

  load();
})();
