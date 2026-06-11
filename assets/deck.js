/* ============================================================
   deck.js — viewer de prezentări
   Folosire: deck.html?p=<director-prezentare>#<nr-slide>

   Configurare opțională, înainte de includerea scriptului:
     window.MDECK = {
       root: "presentations/",   // directorul cu prezentări
       home: "index.html",       // pagina de start (tasta H, linkuri)
       author: "Nume Prenume",   // semnătura de pe primul/ultimul slide
       monogram: "NP"            // monograma semnăturii (implicit: inițialele)
     }
   ============================================================ */

(function () {
  "use strict";

  const CFG = Object.assign(
    { root: "presentations/", home: "index.html", author: null, monogram: null },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

  const DESIGN_W = 1280, DESIGN_H = 720;

  const stage = document.getElementById("stage");
  const progress = document.getElementById("progress");
  const counter = document.getElementById("counter");
  const chipTitle = document.getElementById("chip-title");
  const overview = document.getElementById("overview");
  const errorBox = document.getElementById("deck-error");
  document.getElementById("chip-home").href = CFG.home;

  let slides = [];     // elementele .slide
  let cur = 0;
  let hudTimer = null;

  /* ---------- erori ---------- */
  function showError(title, lines) {
    errorBox.innerHTML =
      '<div class="error-panel"><h2>' + title + "</h2>" +
      lines.map((l) => (l.startsWith("$") ? "<code>" + l.slice(1) + "</code>" : "<p>" + l + "</p>")).join("") +
      '<p><a href="' + CFG.home + '" style="color:var(--teal)">&larr; Înapoi la lista de prezentări</a></p></div>';
    errorBox.classList.add("visible");
  }

  /* ---------- scalare scenă ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H) * 0.96;
    stage.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);

  /* ---------- navigare ---------- */
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

  /* ---------- HUD auto-ascundere ---------- */
  function pokeHud() {
    document.body.classList.add("hud-visible");
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => document.body.classList.remove("hud-visible"), 2600);
  }
  window.addEventListener("mousemove", pokeHud);

  /* ---------- mod ansamblu ---------- */
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
      // scalează miniaturile la lățimea reală a thumb-ului
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

  /* ---------- temă închisă / deschisă ---------- */
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("mdeck-theme", dark ? "dark" : "light"); } catch (e) {}
  }

  /* ---------- tastatură ---------- */
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

  /* ---------- atingere (swipe) ---------- */
  let touchX = null;
  window.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    touchX = null;
  }, { passive: true });

  /* ---------- click pe scenă = înainte ---------- */
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

  /* ---------- încărcare ---------- */
  async function load() {
    const id = new URLSearchParams(location.search).get("p");
    if (!id || /[^\w-]/.test(id)) {
      showError("Prezentare nespecificată", [
        "Deschide acest viewer cu parametrul <code style='display:inline;padding:2px 8px'>?p=nume-prezentare</code>, de exemplu:",
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
      showError("Nu am putut încărca prezentarea „" + id + "”", isFile
        ? ["Pagina este deschisă direct din fișier (file://), iar browserul blochează încărcarea slide-urilor.",
           "Pornește un server local în directorul proiectului:",
           "$python -m http.server 8080",
           "apoi deschide <strong>http://localhost:8080</strong>."]
        : ["Verifică dacă există directorul <strong>" + CFG.root + id + "</strong> și fișierul <strong>presentation.json</strong> în el."]);
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
      showError("Slide lipsă", ["Nu am putut încărca fișierul <strong>" + err.message + "</strong> din " + base]);
      return;
    }

    document.title = meta.title + " — Prezentări";
    chipTitle.textContent = meta.title;
    const deckAccent = meta.accent || "teal";

    sources.forEach((src) => {
      const { fm, html } = MD.parseSlide(src);
      const el = document.createElement("section");
      el.className = "slide layout-" + (fm.layout || "default");
      el.dataset.accent = fm.accent || deckAccent;
      el.innerHTML = html;
      stage.appendChild(el);
      slides.push(el);
    });

    // semnătura autorului (dacă e configurată) — doar pe slide-ul de titlu și pe cel final
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
