// Single source of truth for the app version. Bump this on every deploy that
// changes app.js/index.html/style.css so the service worker cache is
// invalidated and users on old cached versions get the update.
// Loaded both in the page (as a normal script) and in sw.js (via importScripts),
// so it must work in both the window and service-worker global scopes.
(function (scope) {
  "use strict";
  scope.APP_VERSION = "1.1.0";
})(typeof window !== "undefined" ? window : self);
