(function () {
  "use strict";

  var MIN_QUERY_LEN = 3;
  var MAX_RESULTS = 20;
  var fuseInstance = null;
  var indexReady = false;
  var pendingQuery = "";

  function getBaseUrl() {
    if (window.__md_scope instanceof URL) {
      return window.__md_scope;
    }

    var path = window.location.pathname || "/";
    var rootPath = path.replace(/\/[^/]*$/, "/");
    return new URL(rootPath, window.location.origin);
  }

  function getIndexUrl() {
    return new URL("search/search_index.json", getBaseUrl()).toString();
  }

  function createFuse(docs) {
    return new Fuse(docs, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "text", weight: 0.3 }
      ],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }

  function sanitizeText(value) {
    if (!value) {
      return "";
    }
    return String(value).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text, query) {
    var cleanText = sanitizeText(text);
    if (!cleanText || !query) {
      return escapeHtml(cleanText);
    }

    var escapedQuery = escapeRegExp(query);
    var regex = new RegExp("(" + escapedQuery + ")", "gi");
    var highlighted = escapeHtml(cleanText).replace(regex, "<mark>$1</mark>");
    return highlighted;
  }

  function buildSnippet(text, query) {
    var cleanText = sanitizeText(text);
    if (!cleanText) {
      return "";
    }

    var lowerText = cleanText.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var index = lowerText.indexOf(lowerQuery);
    var start = Math.max(0, index - 40);
    var end = Math.min(cleanText.length, start + 180);
    var snippet = cleanText.slice(start, end);

    if (start > 0) {
      snippet = "... " + snippet;
    }
    if (end < cleanText.length) {
      snippet = snippet + " ...";
    }

    return snippet;
  }

  function buildHighlightedSnippet(text, query) {
    var snippet = buildSnippet(text, query);
    return highlightText(snippet, query);
  }

  function resolveUrl(location) {
    try {
      return new URL(location, getBaseUrl()).toString();
    } catch (error) {
      return location;
    }
  }

  function findSearchResultContainer() {
    return document.querySelector("[data-md-component=\"search-result\"]");
  }

  function ensureFuzzyContainer(container) {
    if (!container) {
      return null;
    }

    var existing = container.querySelector(".md-search-fuzzy");
    if (existing) {
      return existing;
    }

    var wrapper = document.createElement("div");
    wrapper.className = "md-search-fuzzy";

    var label = document.createElement("div");
    label.className = "md-search-result__meta";
    label.textContent = "Fuzzy matches";

    var list = document.createElement("ol");
    list.className = "md-search-result__list md-search-fuzzy__list";

    wrapper.appendChild(label);
    wrapper.appendChild(list);
    container.appendChild(wrapper);

    return wrapper;
  }

  function clearFuzzyResults(container) {
    if (!container) {
      return;
    }
    var fuzzyContainer = container.querySelector(".md-search-fuzzy");
    if (!fuzzyContainer) {
      return;
    }
    var list = fuzzyContainer.querySelector(".md-search-fuzzy__list");
    if (list) {
      list.textContent = "";
    }
    fuzzyContainer.style.display = "none";
  }

  function renderFuzzyResults(results, query) {
    var container = findSearchResultContainer();
    if (!container) {
      return;
    }

    var fuzzyContainer = ensureFuzzyContainer(container);
    var list = fuzzyContainer.querySelector(".md-search-fuzzy__list");
    if (!list) {
      return;
    }

    list.textContent = "";

    if (!results.length) {
      fuzzyContainer.style.display = "none";
      return;
    }

    var label = fuzzyContainer.querySelector(".md-search-result__meta");
    if (label) {
      label.textContent = "Fuzzy matches (" + results.length + ")";
    }

    fuzzyContainer.style.display = "block";

    results.forEach(function (result) {
      var doc = result.item || result;
      var item = document.createElement("li");
      item.className = "md-search-result__item";

      var link = document.createElement("a");
      link.className = "md-search-result__link";
      link.href = resolveUrl(doc.location || "");

      var title = document.createElement("div");
      title.className = "md-search-result__title";
      title.innerHTML = highlightText(doc.title || "Untitled", query);

      var teaser = document.createElement("div");
      teaser.className = "md-search-result__teaser";
      teaser.innerHTML = buildHighlightedSnippet(doc.text, query);

      link.appendChild(title);
      link.appendChild(teaser);
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function runFuzzySearch(query) {
    if (!indexReady || !fuseInstance) {
      pendingQuery = query;
      return;
    }

    if (!query || query.length < MIN_QUERY_LEN) {
      clearFuzzyResults(findSearchResultContainer());
      return;
    }

    var results = fuseInstance.search(query, { limit: MAX_RESULTS });
    renderFuzzyResults(results, query);
  }

  function attachSearchListener() {
    var input = document.querySelector("input[data-md-component=\"search-query\"]");
    if (!input) {
      return;
    }

    input.addEventListener("input", function (event) {
      var query = sanitizeText(event.target.value || "");
      window.setTimeout(function () {
        runFuzzySearch(query);
      }, 120);
    });
  }

  function loadSearchIndex() {
    if (!window.Fuse) {
      return;
    }

    fetch(getIndexUrl())
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load search index");
        }
        return response.json();
      })
      .then(function (payload) {
        var docs = Array.isArray(payload.docs) ? payload.docs : [];
        fuseInstance = createFuse(docs);
        indexReady = true;
        if (pendingQuery) {
          runFuzzySearch(pendingQuery);
          pendingQuery = "";
        }
      })
      .catch(function () {
        indexReady = false;
      });
  }

  function init() {
    attachSearchListener();
    loadSearchIndex();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
