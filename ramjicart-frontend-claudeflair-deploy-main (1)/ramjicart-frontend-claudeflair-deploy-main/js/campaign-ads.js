(function () {
    "use strict";

    const apiRoot = String(typeof API_BASE !== "undefined" ? API_BASE : (typeof API_URL !== "undefined" ? API_URL + "/api" : "")).replace(/\/+$/, "");
    const rawFetch = window.ramjicartAdsFetch || window.fetch.bind(window);
    const deviceKey = "ramjicart.ads.deviceId";
    let deviceId = localStorage.getItem(deviceKey);
    if (!deviceId) {
        deviceId = "device-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem(deviceKey, deviceId);
    }

    function currentPincode() {
        try {
            const location = JSON.parse(sessionStorage.getItem("restaurantSearchLocation") || "null");
            return location && /^\d{6}$/.test(location.pincode || "") ? location.pincode : "";
        } catch (_) {
            return "";
        }
    }

    async function request(path, options) {
        if (!apiRoot) throw new Error("Ads API is unavailable.");
        return rawFetch(apiRoot + path, Object.assign({ cache: "no-store", credentials: "omit" }, options || {}));
    }

    async function getAds(placement) {
        const query = new URLSearchParams({ placement: placement, pincode: currentPincode(), device_id: deviceId });
        const response = await request("/ads?" + query.toString());
        if (!response.ok) throw new Error("Ads unavailable");
        const payload = await response.json();
        return Array.isArray(payload.ads) ? payload.ads : [];
    }

    function sendEvent(ad, type, duration) {
        const payload = JSON.stringify({ type: type, duration_ms: duration || 0, view_token: type === "VIEW" ? ad.view_token : "", pincode: currentPincode(), device_id: deviceId });
        request("/ads/" + encodeURIComponent(ad.id) + "/events", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true
        }).catch(function () {});
    }

    async function toggleLike(ad, button) {
        const liked = button.getAttribute("aria-pressed") === "true";
        const path = liked ? "/ads/" + encodeURIComponent(ad.id) + "/unlike" : "/ads/" + encodeURIComponent(ad.id) + "/events";
        const body = liked
            ? { device_id: deviceId, pincode: currentPincode() }
            : { type: "LIKE", device_id: deviceId, pincode: currentPincode() };
        try {
            const response = await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (response.ok) {
                button.setAttribute("aria-pressed", String(!liked));
                button.textContent = liked ? "♡" : "♥";
            }
        } catch (_) {}
    }

    function buildAdLink(ad, className) {
        const link = document.createElement("a");
        link.className = className;
        link.href = ad.link_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer sponsored";
        link.setAttribute("aria-label", ad.title || "Sponsored offer");
        link.addEventListener("click", function () { sendEvent(ad, "CLICK"); });
        return link;
    }

    function buildLikeButton(ad) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "campaign-ad-like";
        button.setAttribute("aria-label", "Like this ad");
        button.setAttribute("aria-pressed", String(Boolean(ad.liked)));
        button.textContent = ad.liked ? "♥" : "♡";
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            toggleLike(ad, button);
        });
        return button;
    }

    function observeView(element, ad) {
        if (!("IntersectionObserver" in window)) return;
        let timer = 0;
        let sent = false;
        const observer = new IntersectionObserver(function (entries) {
            const visible = entries.some(function (entry) { return entry.isIntersecting && entry.intersectionRatio >= 0.5; });
            if (visible && !timer && !sent) {
                timer = window.setTimeout(function () {
                    sent = true;
                    sendEvent(ad, "VIEW", 1000);
                }, 1000);
            } else if (!visible && timer) {
                window.clearTimeout(timer);
                timer = 0;
            }
        }, { threshold: [0.5] });
        observer.observe(element);
    }

    async function mountCarousel(container) {
        try {
            const ads = await getAds("HOME_BANNER");
            if (!ads.length) return;
            container.hidden = false;
            const track = container.querySelector("[data-ad-track]");
            const dots = container.querySelector("[data-ad-dots]");
            let index = 0;
            let rotation = 0;
            const cards = ads.map(function (ad, position) {
                const card = document.createElement("article");
                card.className = "campaign-ad-card";
                card.hidden = position !== 0;
                const link = buildAdLink(ad, "campaign-ad-link");
                const image = document.createElement("img");
                image.src = ad.image;
                image.alt = ad.title || "Sponsored offer";
                image.loading = "lazy";
                image.addEventListener("error", function () { card.remove(); }, { once: true });
                link.appendChild(image);
                const label = document.createElement("span");
                label.className = "campaign-ad-label";
                label.textContent = "Ad";
                card.append(link, label, buildLikeButton(ad));
                track.appendChild(card);
                observeView(card, ad);
                return card;
            });
            const validCards = cards.filter(function (card) { return card.isConnected; });
            if (!validCards.length) { container.hidden = true; return; }
            if (validCards.length > 1) {
                validCards.forEach(function (_, dotIndex) {
                    const dot = document.createElement("button");
                    dot.type = "button";
                    dot.className = "campaign-ad-dot";
                    dot.setAttribute("aria-label", "Show ad " + (dotIndex + 1));
                    dot.addEventListener("click", function () { rotation = 0; index = dotIndex; paint(); });
                    dots.appendChild(dot);
                });
                rotation = window.setInterval(function () { index = (index + 1) % validCards.length; paint(); }, 4000);
                container.addEventListener("pointerdown", pause, { once: true });
                container.addEventListener("touchstart", pause, { once: true, passive: true });
                container.addEventListener("click", pause, { once: true });
            }
            function pause() { if (rotation) window.clearInterval(rotation); rotation = 0; }
            function paint() {
                validCards.forEach(function (card, cardIndex) { card.hidden = cardIndex !== index; });
                Array.from(dots.children).forEach(function (dot, dotIndex) { dot.setAttribute("aria-current", String(dotIndex === index)); });
            }
            paint();
        } catch (_) {
            container.hidden = true;
        }
    }

    async function mountOffers(container) {
        const message = container.querySelector("[data-offers-message]");
        const list = container.querySelector("[data-offers-list]");
        try {
            const ads = await getAds("OFFERS");
            if (!ads.length) { message.textContent = "Abhi koi active offer available nahi hai."; return; }
            message.hidden = true;
            ads.forEach(function (ad) {
                const card = document.createElement("article");
                card.className = "campaign-offer-card";
                const link = buildAdLink(ad, "campaign-offer-link");
                const image = document.createElement("img");
                image.src = ad.image;
                image.alt = ad.title || "Offer";
                image.loading = "lazy";
                const title = document.createElement("h2");
                title.textContent = ad.title || "Special offer";
                link.append(image, title);
                const label = document.createElement("span");
                label.className = "campaign-ad-label";
                label.textContent = "Ad";
                card.append(link, label, buildLikeButton(ad));
                list.appendChild(card);
                observeView(card, ad);
            });
        } catch (_) {
            message.textContent = "Offers abhi load nahi ho paaye. Thodi der baad try karein.";
        }
    }

    async function showPostPayment() {
        const shell = document.getElementById("postPaymentAd");
        if (!shell) return;
        try {
            const ads = await getAds("POST_PAYMENT_FULLSCREEN");
            if (!ads.length || !ads[0].image) return;
            const ad = ads[0];
            const link = buildAdLink(ad, "post-payment-ad-link");
            const image = document.createElement("img");
            image.src = ad.image;
            image.alt = ad.title || "Sponsored offer";
            image.addEventListener("error", function () { shell.remove(); }, { once: true });
            const title = document.createElement("span");
            title.textContent = ad.title || "Sponsored offer";
            link.append(image, title);
            const skip = shell.querySelector("[data-ad-skip]");
            shell.querySelector("[data-post-ad-content]").append(link, buildLikeButton(ad));
            shell.hidden = false;
            observeView(shell, ad);
            let seconds = 3;
            skip.disabled = true;
            skip.textContent = "Skip in 3";
            const count = window.setInterval(function () {
                seconds -= 1;
                if (seconds <= 0) {
                    window.clearInterval(count);
                    skip.disabled = false;
                    skip.textContent = "Skip ad";
                } else skip.textContent = "Skip in " + seconds;
            }, 1000);
            skip.addEventListener("click", function () { window.clearInterval(count); shell.hidden = true; }, { once: true });
        } catch (_) {
            shell.hidden = true;
        }
    }

    window.RamjicartCampaignAds = { mountCarousel: mountCarousel, mountOffers: mountOffers, showPostPayment: showPostPayment, currentPincode: currentPincode };

    document.addEventListener("DOMContentLoaded", function () {
        const carousel = document.querySelector("[data-campaign-carousel]");
        if (carousel) mountCarousel(carousel);
        const offers = document.querySelector("[data-campaign-offers]");
        if (offers) mountOffers(offers);
    });
})();
