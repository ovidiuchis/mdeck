/* ============================================================
   mdeck.js — single entry point for the MDECK engine.

   Include just this one script on any page:
     <script src="assets/mdeck.js"></script>

   It detects the page's role and loads the matching module:
     • home library  — when the page has a <main id="decks"> container
                        (or window.MDECK.page === "home")
     • deck viewer   — otherwise (or window.MDECK.page === "deck")

   The module (home.js / deck.js) then self-bootstraps: injects the
   stylesheet + fonts, loads its dependencies and builds the chrome.

   The two modules are kept separate on purpose: a home page never
   ships the viewer code, and vice versa. This also maps cleanly onto
   a future bundled/npm build (one entry, tree-shakeable modules).
   ============================================================ */

(function () {
  "use strict";

  const SELF = (document.currentScript && document.currentScript.src) || "";
  const ASSETS = SELF.replace(/[^/]*$/, "");
  const page = (window.MDECK || {}).page;

  const isHome =
    page === "home" || (page !== "deck" && !!document.getElementById("decks"));

  const s = document.createElement("script");
  s.src = ASSETS + (isHome ? "home.js" : "deck.js");
  document.head.appendChild(s);
})();
