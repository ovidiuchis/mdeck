/* ============================================================
   home.js — pagina de start: listează prezentările
   Configurare opțională, înainte de includerea scriptului:
     window.MDECK = {
       root: "presentations/",   // directorul cu prezentări
       deck: "deck.html"         // pagina viewer-ului
     }
   ============================================================ */

(function () {
  "use strict";

  const CFG = Object.assign(
    { root: "presentations/", deck: "deck.html" },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

  /* ---------- temă închisă / deschisă ---------- */
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("mdeck-theme", dark ? "dark" : "light"); } catch (e) {}
  }
  const themeBtn = document.getElementById("btn-theme");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
  window.addEventListener("keydown", (e) => {
    if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleTheme();
  });

  /* ---------- lista de prezentări ---------- */
  (async function () {
    const root = document.getElementById("decks");

    function fail(isFile) {
      root.innerHTML =
        '<div class="error-panel" style="grid-column:1/-1">' +
        '<h2>Nu am putut încărca lista de prezentări</h2>' +
        (isFile
          ? '<p>Pagina este deschisă direct din fișier (file://), iar browserul blochează încărcarea datelor. Pornește un server local în directorul proiectului:</p>' +
            '<code>python -m http.server 8080</code>' +
            '<p>apoi deschide <strong>http://localhost:8080</strong>.</p>'
          : '<p>Verifică dacă există fișierul <strong>' + CFG.root + 'index.json</strong>.</p>') +
        "</div>";
    }

    let list;
    try {
      list = await (await fetch(CFG.root + "index.json")).json();
    } catch (e) {
      fail(location.protocol === "file:");
      return;
    }

    /* normalizare: formatul vechi (listă plată) devine o colecție fără titlu */
    const collections = Array.isArray(list.collections) ? list.collections.slice() : [];
    if (Array.isArray(list.presentations) && list.presentations.length)
      collections.push({ presentations: list.presentations });

    /* metadatele tuturor prezentărilor, încărcate o singură dată */
    const ids = [...new Set(collections.flatMap((c) => c.presentations || []))];
    const metas = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          metas[id] = await (await fetch(CFG.root + id + "/presentation.json")).json();
        } catch (e) {}
      })
    );

    function card(id, meta) {
      const a = document.createElement("a");
      a.className = "deck-card";
      a.href = CFG.deck + "?p=" + encodeURIComponent(id);
      a.dataset.accent = meta.accent || "teal";
      a.innerHTML =
        '<div class="meta">Prezentare &middot; ' + meta.slides.length + " slide-uri</div>" +
        "<h2>" + meta.title + "</h2>" +
        "<p>" + (meta.description || meta.subtitle || "") + "</p>" +
        '<div class="foot"><div class="tags">' +
        (meta.tags || []).map((t) => '<span class="tag">' + t + "</span>").join("") +
        '</div><span class="go">Deschide &rarr;</span></div>';
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
