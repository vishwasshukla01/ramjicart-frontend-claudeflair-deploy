(function () {
    "use strict";
    // Keep public ads requests outside the authenticated API wrapper and its session cache.
    window.ramjicartAdsFetch = window.fetch.bind(window);
})();
