/* ============================================================
   md.js — adaptor peste markdown-it + highlight.js (vendorizate
   în assets/vendor/, deci totul funcționează offline / intranet).

   Păstrează ce e specific prezentărilor noastre:
     • frontmatter per slide (--- layout / accent / image ---)
     • containerele ::: pentru layout:
         ::: grid 2|3|4|1-2     grilă de coloane (și proporții ex. 1-2)
         ::: split / ::: col    două jumătăți centrate vertical
         ::: columns 2|3        text curgător pe mai multe coloane
         ::: card <accent>      card colorat (teal, indigo, violet, amber, rose, emerald, sky)
         ::: stat <accent>      statistică mare (## număr + paragraf etichetă)
         ::: timeline           cronologie verticală (dintr-o listă)
         ::: steps              pași numerotați (dintr-o listă numerotată)
         ::: callout info|warn|ok|tip   casetă de notă colorată
         :::                    închide containerul curent
     • iconițe inline  :check: :rocket: ...  (SVG vendorizat, vezi ICONS)
     • taste inline    [[Ctrl+S]] → <kbd>
     • diagrame        ```mermaid ... ```  (randate lazy de deck.js)
     • formule         $inline$ și $$bloc$$ (randate lazy cu KaTeX de deck.js)
   Restul sintaxei Markdown (CommonMark + tabele GFM) e tratat
   integral de markdown-it; highlighting-ul de cod de highlight.js.
   ============================================================ */

(function (global) {
  "use strict";

  const hljs = global.hljs;

  const md = global.markdownit({
    html: true,
    linkify: true,
    typographer: false,
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        } catch (e) { /* cade pe escaping-ul implicit */ }
      }
      return "";
    },
  });

  // link-urile se deschid în tab nou
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener");
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  function escAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /* ---------- iconițe inline :name: (SVG, currentColor) ---------- */
  /* set Feather-style; toate 24×24, fără fill, stroke = culoarea textului */
  const I = (p) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  const ICONS = {
    check:  I('<polyline points="20 6 9 17 4 12"/>'),
    x:      I('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    star:   I('<polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9"/>'),
    arrow:  I('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
    zap:    I('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
    info:   I('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    alert:  I('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    heart:  I('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78z"/>'),
    rocket: I('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'),
    code:   I('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    database: I('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
    leaf:   I('<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>'),
    clock:  I('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    users:  I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    lock:   I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    chart:  I('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
    bulb:   I('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/>'),
    flag:   I('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
    mail:   I('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>'),
    calendar: I('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    target: I('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    globe:  I('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  };

  md.inline.ruler.before("emphasis", "icon", function (state, silent) {
    if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) return false;
    const m = /^:([a-z][a-z0-9-]*):/.exec(state.src.slice(state.pos));
    if (!m || !ICONS[m[1]]) return false;
    if (!silent) state.push("icon", "", 0).meta = { name: m[1] };
    state.pos += m[0].length;
    return true;
  });
  md.renderer.rules.icon = (tokens, idx) =>
    '<span class="icon">' + ICONS[tokens[idx].meta.name] + "</span>";

  /* ---------- taste inline [[Ctrl+S]] → <kbd> ---------- */
  md.inline.ruler.before("emphasis", "kbd", function (state, silent) {
    if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
    const m = /^\[\[([^\]\n]+)\]\]/.exec(state.src.slice(state.pos));
    if (!m) return false;
    if (!silent) state.push("kbd", "", 0).content = m[1];
    state.pos += m[0].length;
    return true;
  });
  md.renderer.rules.kbd = (tokens, idx) =>
    "<kbd>" + md.utils.escapeHtml(tokens[idx].content) + "</kbd>";

  /* ---------- diagrame ```mermaid → <pre class="mermaid"> ---------- */
  const defaultFence =
    md.renderer.rules.fence ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    if ((tokens[idx].info || "").trim().toLowerCase() === "mermaid") {
      return '<pre class="mermaid">' + md.utils.escapeHtml(tokens[idx].content) + "</pre>";
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  /* ---------- containerele ::: (cu imbricare) ---------- */

  function accentAttr(a) {
    return a ? ' data-accent="' + escAttr(a) + '"' : "";
  }

  function containerOpen(rest) {
    const t = rest.trim().split(/\s+/);
    const kind = t[0].toLowerCase();

    if (kind === "grid" || kind === "cols") {
      const spec = t[1] || "2";
      // proporții explicite: "1-2", "1-2-1" → grid-template-columns
      if (/^\d+(-\d+)+$/.test(spec)) {
        const tpl = spec.split("-").map((c) => c + "fr").join(" ");
        return '<div class="grid" style="grid-template-columns:' + tpl + '">';
      }
      const n = Math.min(Math.max(parseInt(spec, 10) || 2, 1), 6);
      return '<div class="grid g' + n + '">';
    }
    if (kind === "split") return '<div class="split">';
    if (kind === "col") return '<div class="col">';
    if (kind === "columns") {
      const n = Math.min(Math.max(parseInt(t[1], 10) || 2, 2), 4);
      return '<div class="columns" style="column-count:' + n + '">';
    }
    if (kind === "card") return '<div class="card"' + accentAttr(t[1]) + ">";
    if (kind === "stat") return '<div class="stat"' + accentAttr(t[1]) + ">";
    if (kind === "timeline") return '<div class="timeline">';
    if (kind === "steps") return '<div class="steps">';
    if (kind === "callout") {
      const v = (t[1] || "info").toLowerCase();
      return '<div class="callout callout-' + escAttr(v) + '">';
    }
    return '<div class="' + escAttr(t.join(" ")) + '">';
  }

  /* Scoate formulele $…$ / $$…$$ din text înainte de markdown-it (altfel
     `_`, `*`, `<` din LaTeX sunt interpretate), lăsând un placeholder din
     zona Unicode privată (trece neatins prin markdown-it). Codul (fence și
     `inline`) e sărit. deck.js le randează apoi cu KaTeX, la cerere. */
  function stashMath(src, math) {
    const PH = (tex, display) =>
      "" + (math.push({ tex: tex.trim(), display }) - 1) + "";
    // separă blocurile de cod ```…``` (impare) de restul (pare)
    return src
      .split(/(```[\s\S]*?```)/g)
      .map((part, i) => {
        if (i % 2) return part; // bloc de cod — neatins
        // separă codul inline `…` (impar) de text (par)
        return part
          .split(/(`+[^`]*`+)/g)
          .map((seg, j) => {
            if (j % 2) return seg; // cod inline — neatins
            return seg
              .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => PH(t, true))
              .replace(/\$(?![\s$])((?:\\.|[^$\\\n])*?)(?<!\s)\$/g, (_, t) => PH(t, false));
          })
          .join("");
      })
      .join("");
  }

  /* Împarte sursa la liniile ::: (ignorându-le pe cele din blocuri
     de cod) și redă fiecare segment cu markdown-it. */
  function render(src) {
    src = src.replace(/\r\n/g, "\n");
    const math = [];
    const lines = stashMath(src, math).split("\n");
    const out = [];
    let buf = [];
    let openDivs = 0;
    let inFence = false;

    function flush() {
      const text = buf.join("\n");
      if (text.trim()) out.push(md.render(text));
      buf = [];
    }

    for (const line of lines) {
      if (/^```/.test(line)) inFence = !inFence;

      const cont = !inFence && line.match(/^:::\s*(.*)$/);
      if (cont) {
        flush();
        if (cont[1].trim() === "") {
          if (openDivs > 0) { out.push("</div>"); openDivs--; }
        } else {
          out.push(containerOpen(cont[1]));
          openDivs++;
        }
        continue;
      }
      buf.push(line);
    }

    flush();
    while (openDivs-- > 0) out.push("</div>");

    let html = out.join("\n");
    if (math.length) {
      html = html
        .replace(/(\d+)/g, (_, i) => {
          const m = math[i];
          const esc = md.utils.escapeHtml(m.tex);
          return m.display
            ? '<div class="math math-display">' + esc + "</div>"
            : '<span class="math">' + esc + "</span>";
        })
        // scoate <p> care învelește o singură formulă-bloc (div invalid în p)
        .replace(/<p>\s*(<div class="math math-display">[\s\S]*?<\/div>)\s*<\/p>/g, "$1");
    }
    return html;
  }

  /* ---------- frontmatter slide ---------- */

  function parseSlide(src) {
    src = src.replace(/^﻿/, "");
    const fm = {};
    const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    let body = src;
    if (m) {
      body = src.slice(m[0].length);
      for (const line of m[1].split("\n")) {
        const kv = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
        if (kv) fm[kv[1].toLowerCase()] = kv[2];
      }
    }
    return { fm, html: render(body) };
  }

  function highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return md.utils.escapeHtml(code);
  }

  global.MD = { render, parseSlide, highlight };
})(window);
