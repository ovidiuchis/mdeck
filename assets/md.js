/* ============================================================
   md.js — adaptor peste markdown-it + highlight.js (vendorizate
   în assets/vendor/, deci totul funcționează offline / intranet).

   Păstrează ce e specific prezentărilor noastre:
     • frontmatter per slide (--- layout / accent ---)
     • containerele ::: pentru layout:
         ::: grid 2|3|4         grilă de coloane
         ::: card <accent>      card colorat (teal, indigo, violet, amber, rose, emerald, sky)
         ::: stat <accent>      statistică mare (## număr + paragraf etichetă)
         :::                    închide containerul curent
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

  /* ---------- containerele ::: (cu imbricare) ---------- */

  function containerOpen(rest) {
    const t = rest.trim().split(/\s+/);
    const kind = t[0].toLowerCase();
    if (kind === "grid" || kind === "cols") {
      const n = Math.min(Math.max(parseInt(t[1], 10) || 2, 2), 4);
      return '<div class="grid g' + n + '">';
    }
    if (kind === "card") {
      return '<div class="card"' + (t[1] ? ' data-accent="' + escAttr(t[1]) + '"' : "") + ">";
    }
    if (kind === "stat") {
      return '<div class="stat"' + (t[1] ? ' data-accent="' + escAttr(t[1]) + '"' : "") + ">";
    }
    return '<div class="' + escAttr(t.join(" ")) + '">';
  }

  /* Împarte sursa la liniile ::: (ignorându-le pe cele din blocuri
     de cod) și redă fiecare segment cu markdown-it. */
  function render(src) {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
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
    return out.join("\n");
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
