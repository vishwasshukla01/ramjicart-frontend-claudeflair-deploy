(function () {
    "use strict";

    var allowedPages = [
        "index.html",
        "cartpage.html",
        "resturentpage.html",
        "resturenthomepage.html",
        "resturentdeliverypage.html"
    ];
    var currentPage = window.location.pathname.split("/").pop() || "index.html";
    if (allowedPages.indexOf(currentPage) === -1) return;

    if (!document.body || document.querySelector("[data-adsterra-social-bar]")) return;

    var socialBar = document.createElement("script");
    socialBar.src = "https://bauval.org/14/ff45695a2f71476247914e401da52180";
    socialBar.setAttribute("data-cfasync", "false");
    socialBar.setAttribute("data-adsterra-social-bar", "true");
    document.body.appendChild(socialBar);
})();
