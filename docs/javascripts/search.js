/*
 * Pagefind search: the site search dialog in the header, the per-collection
 * transcription search page, and highlighting of search terms on result pages.
 * The indexes are built by scripts/build_search_index.py after `mkdocs build`.
 */
(function () {
  "use strict";

  var sitePath = new URL(window.tanapSiteRoot || "./", location.href).pathname;
  var HIGHLIGHT_PARAM = "highlight";

  function bundle(name) {
    return sitePath + "pagefind/" + name + "/";
  }

  var uiLoaded;
  function loadPagefindUI() {
    if (!uiLoaded) {
      uiLoaded = new Promise(function (resolve, reject) {
        var css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = bundle("site") + "pagefind-ui.css";
        document.head.append(css);
        var script = document.createElement("script");
        script.src = bundle("site") + "pagefind-ui.js";
        script.onload = resolve;
        script.onerror = function () {
          uiLoaded = null;
          reject(new Error("Search is not available (index not built?)"));
        };
        document.head.append(script);
      });
    }
    return uiLoaded;
  }

  function createSearch(element, name, options) {
    return new PagefindUI(Object.assign({
      element: element,
      bundlePath: bundle(name),
      baseUrl: sitePath,
      showSubResults: true,
      showImages: false,
      excerptLength: 25,
      highlightParam: HIGHLIGHT_PARAM
    }, options));
  }

  function showError(element, error) {
    element.textContent = error.message;
  }

  /* Site search dialog */

  var dialog = document.querySelector(".tanap-search-dialog");
  var siteSearch;

  function openSiteSearch() {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    var container = dialog.querySelector(".tanap-site-search");
    loadPagefindUI().then(function () {
      if (!siteSearch) {
        siteSearch = createSearch(container, "site", {
          translations: { placeholder: "Search pages and PDFs" }
        });
      }
      var input = container.querySelector("input");
      if (input) input.focus();
    }, function (error) { showError(container, error); });
  }

  if (dialog) {
    document.querySelectorAll(".tanap-search-open").forEach(function (button) {
      button.addEventListener("click", openSiteSearch);
    });
    dialog.querySelector(".tanap-search-close").addEventListener("click", function () {
      dialog.close();
    });
    // Close when clicking the backdrop
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    // Take over Material's search shortcuts (f, s, /). Registered on window in
    // the capture phase, so this runs before Material's own key handler.
    window.addEventListener("keydown", function (event) {
      if (dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
      if (["f", "s", "/"].indexOf(event.key) < 0) return;
      var target = event.target;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSiteSearch();
    }, true);
  }

  /* Transcription search page: one search per collection, shown as tabs */

  var collectionSearch = document.querySelector(".tanap-collection-search");
  if (collectionSearch) {
    var tabs = collectionSearch.querySelectorAll("[role=tab]");
    var searches = {};
    var params = new URLSearchParams(location.search);

    var updateUrl = function (collection, term) {
      var url = new URL(location.href);
      url.searchParams.set("collection", collection);
      if (term) url.searchParams.set("q", term);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
    };

    var selectTab = function (tab, term) {
      var collection = tab.dataset.collection;
      tabs.forEach(function (other) {
        var selected = other === tab;
        other.setAttribute("aria-selected", selected);
        other.tabIndex = selected ? 0 : -1;
        collectionSearch.querySelector("#" + other.getAttribute("aria-controls")).hidden = !selected;
      });
      var panel = collectionSearch.querySelector("#" + tab.getAttribute("aria-controls"));
      loadPagefindUI().then(function () {
        if (!searches[collection]) {
          searches[collection] = createSearch(panel, collection, {
            autofocus: true,
            translations: { placeholder: "Search the " + tab.textContent.trim() + " transcriptions" },
            processTerm: function (t) { updateUrl(collection, t); return t; }
          });
        }
        if (term) searches[collection].triggerSearch(term);
        updateUrl(collection, term || (panel.querySelector("input") || {}).value);
      }, function (error) { showError(panel, error); });
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        // Carry the current search over to the other collection
        var current = collectionSearch.querySelector("[role=tabpanel]:not([hidden]) input");
        if (tab.getAttribute("aria-selected") !== "true") selectTab(tab, current && current.value);
      });
      tab.addEventListener("keydown", function (event) {
        var step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        var next = tabs[(i + step + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });

    var initial = Array.prototype.find.call(tabs, function (tab) {
      return tab.dataset.collection === params.get("collection");
    }) || tabs[0];
    selectTab(initial, params.get("q"));
  }

  /* Highlight the search terms when arriving from a search result */

  if (new URLSearchParams(location.search).has(HIGHLIGHT_PARAM)) {
    var article = document.querySelector("article.md-content__inner");
    import(bundle("site") + "pagefind-highlight.js").then(function (module) {
      new module.default({ highlightParam: HIGHLIGHT_PARAM, markContext: article });
    }).catch(function () { /* highlighting is optional */ });
  }
})();
