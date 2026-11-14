// AD SLOT
(function () {
    "use strict";

    const ADS_CONFIG = {
        enabled: true,
        client: "ca-pub-XXXXXXXXXXXXXXXX",
        showPlaceholders: false,
        slots: {
            "home-top": { id: "XXXXXXXXXX", enabled: true },
            "home-middle": { id: "XXXXXXXXXX", enabled: true },
            "order-middle": { id: "XXXXXXXXXX", enabled: false }
        }
    };

    const wrappers = Array.from(document.querySelectorAll(".ad-wrapper[data-ad-slot]"));
    if (!ADS_CONFIG.enabled) return;

    const validClient = /^ca-pub-\d+$/.test(ADS_CONFIG.client);
    const validSlots = wrappers.map(function (wrapper) {
        const slot = ADS_CONFIG.slots[wrapper.dataset.adSlot];
        return {
            wrapper: wrapper,
            slot: slot,
            target: wrapper.querySelector(".ad-slot")
        };
    }).filter(function (entry) {
        return entry.slot && entry.slot.enabled && entry.target;
    });

    function activate(wrapper) {
        wrapper.classList.add("is-active");
    }

    function showPlaceholder(entry) {
        entry.target.textContent = "Ad placeholder: " + entry.wrapper.dataset.adSlot;
        activate(entry.wrapper);
    }

    const readySlots = validSlots.filter(function (entry) {
        return validClient && /^\d+$/.test(entry.slot.id);
    });

    if (!validClient || !readySlots.length) {
        if (ADS_CONFIG.showPlaceholders) validSlots.forEach(showPlaceholder);
        return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="
        + encodeURIComponent(ADS_CONFIG.client);
    document.head.appendChild(script);

    readySlots.forEach(function (entry) {
        try {
            const ins = document.createElement("ins");
            ins.className = "adsbygoogle";
            ins.style.display = "block";
            ins.dataset.adClient = ADS_CONFIG.client;
            ins.dataset.adSlot = entry.slot.id;
            ins.dataset.adFormat = "auto";
            ins.dataset.fullWidthResponsive = "true";
            entry.target.appendChild(ins);

            const observer = new MutationObserver(function () {
                const status = ins.getAttribute("data-ad-status");
                if (status === "filled") activate(entry.wrapper);
                else if (status === "unfilled") entry.wrapper.classList.remove("is-active");
            });
            observer.observe(ins, {
                attributes: true,
                attributeFilter: ["data-ad-status"]
            });

            if (ins.getAttribute("data-ad-status") === "filled") activate(entry.wrapper);
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
            console.error("Ad slot failed to initialize:", entry.wrapper.dataset.adSlot, error);
        }
    });
})();
