/* ============================================================
   home.js — home page: lists the presentations
   Optional configuration, before including the script:
     window.MDECK = {
       root: "presentations/",   // presentations folder
       deck: "deck.html",        // viewer page
       strings: { ... }          // UI text overrides (see STR below)
     }
   ============================================================ */

(function () {
  "use strict";

  const CFG = Object.assign(
    { root: "presentations/", deck: "deck.html" },
    window.MDECK || {}
  );
  if (!CFG.root.endsWith("/")) CFG.root += "/";

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

    function card(id, meta) {
      const a = document.createElement("a");
      a.className = "deck-card";
      a.href = CFG.deck + "?p=" + encodeURIComponent(id);
      a.dataset.accent = meta.accent || "teal";
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
