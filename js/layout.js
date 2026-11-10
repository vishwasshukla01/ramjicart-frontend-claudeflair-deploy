(function () {
    "use strict";

    const fragments = {
        homeHeader: `
            <header>
                <nav>
                    <h1><img loading="lazy" src="images/logo%20(2).png" alt="Ramjicart logo" style="width:42px;height:42px;object-fit:contain;vertical-align:middle"> Ramjicart</h1>
                    <div class="nav-links">
                        <a href="resturentpage.html">Restaurants</a>
                        <a href="#orderHistory">Order history</a>
                        <a href="cartpage.html" id="cartLink">🛒 Cart</a>
                        <a href="contact.html">contact us</a>
                    </div>
                    <div class="account-menu">
                        <button id="homepageLocationButton" type="button" aria-haspopup="dialog" aria-controls="homepageLocationDialog">📍 Location</button>
                        <a href="login.html" id="accountLink">Sign in</a>
                        <section id="customerProfile" aria-label="Customer profile" hidden>
                            <h2>Your profile</h2>
                            <div class="customer-profile-grid">
                                <div class="customer-profile-field"><span>Name</span><strong id="customerProfileName"></strong></div>
                                <div class="customer-profile-field"><span>Email</span><strong id="customerProfileEmail"></strong></div>
                                <div class="customer-profile-field"><span>Phone</span><strong id="customerProfilePhone"></strong></div>
                            </div>
                            <div id="themeSwitcherBar" role="group" aria-label="Choose website color theme">
                                <span>🎨 Select Color:</span>
                                <button type="button" data-theme-choice="1">1: Cosmic Glass</button>
                                <button type="button" data-theme-choice="2">2: Midnight Slate</button>
                                <button type="button" data-theme-choice="3">3: Charcoal</button>
                                <button type="button" data-theme-choice="4">4: Milky Pearl</button>
                                <button type="button" data-theme-choice="5">5: Sunset Amber</button>
                                <button type="button" data-theme-choice="0">Original White</button>
                            </div>
                            <button id="signOutButton" type="button">Sign out</button>
                        </section>
                    </div>
                </nav>
            </header>`,
        homeFooter: /* CART UI */ `
            <footer>
                <p>© 2026 Ramjicart. All rights reserved.</p>
                <p>
                    <a href="terms.html">Terms and Conditions</a> ·
                    <a href="privacy.html">Privacy Policy</a> ·
                    <a href="refund.html">Cancellation &amp; Refund Policy</a> ·
                    <a href="contact.html">Contact &amp; Support</a>
                </p>
            </footer>`,
        legalHeader: `
            <header>
                <div class="header-inner">
                    <a href="index.html" aria-label="Ramjicart home"><img loading="lazy" src="images/logo%20(2).png" alt="Ramjicart logo"></a>
                    <a class="brand" href="index.html">Ramjicart</a>
                </div>
            </header>`
    };

    document.querySelectorAll("[data-layout-fragment]").forEach(function (placeholder) {
        const fragment = fragments[placeholder.dataset.layoutFragment];
        if (fragment) {
            placeholder.insertAdjacentHTML("beforebegin", fragment);
            placeholder.remove();
        }
    });

    const homepageLocationButton = document.getElementById("homepageLocationButton");
    if (homepageLocationButton && !document.getElementById("shopsNearYou")) {
        homepageLocationButton.hidden = true;
    }

    const galleries = new WeakMap();
    let viewer;
    let viewerImage;
    let imageCounter;
    let previousButton;
    let nextButton;
    let activeImages = [];
    let activeIndex = 0;
    let zoomScale = 1;
    let panX = 0;
    let panY = 0;
    let zoomResetButton;
    const activePointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let pinchImageX = 0;
    let pinchImageY = 0;
    let swipeStart = null;

    function imageUrls(item) {
        const urls = [];
        function add(value) {
            if (typeof value === "string" && value.trim() && !urls.includes(value.trim())) {
                urls.push(value.trim());
            }
        }
        add(item && item.image);
        if (item && Array.isArray(item.images)) {
            item.images.forEach(function (image) {
                add(typeof image === "string" ? image : image && image.url);
            });
        }
        return urls;
    }

    function renderViewerImage() {
        resetViewerZoom();
        viewerImage.src = activeImages[activeIndex];
        imageCounter.textContent = activeImages.length > 1
            ? (activeIndex + 1) + " / " + activeImages.length
            : "";
        previousButton.hidden = activeImages.length < 2;
        nextButton.hidden = activeImages.length < 2;
    }

    function moveViewerImage(direction) {
        if (activeImages.length < 2) return;
        activeIndex = (activeIndex + direction + activeImages.length) % activeImages.length;
        renderViewerImage();
    }

    function closeViewer() {
        if (viewer.open && typeof viewer.close === "function") viewer.close();
        else viewer.removeAttribute("open");
    }

    function clampZoom(value) {
        return Math.max(1, Math.min(4, value));
    }

    function applyViewerZoom() {
        viewerImage.style.transform =
            "translate(" + panX + "px, " + panY + "px) scale(" + zoomScale + ")";
        viewerImage.classList.toggle("is-zoomed", zoomScale > 1);
        zoomResetButton.disabled = zoomScale === 1;
    }

    function resetViewerZoom() {
        zoomScale = 1;
        panX = 0;
        panY = 0;
        if (viewerImage && zoomResetButton) applyViewerZoom();
    }

    function zoomBy(amount) {
        zoomScale = clampZoom(zoomScale + amount);
        if (zoomScale === 1) {
            panX = 0;
            panY = 0;
        }
        applyViewerZoom();
    }

    function pointerDistance(first, second) {
        return Math.hypot(second.x - first.x, second.y - first.y);
    }

    function pointerCenter(first, second) {
        return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    }

    function clampPan() {
        const bounds = viewerImage.parentElement.getBoundingClientRect();
        const maxX = bounds.width * (zoomScale - 1) / 2;
        const maxY = bounds.height * (zoomScale - 1) / 2;
        panX = Math.max(-maxX, Math.min(maxX, panX));
        panY = Math.max(-maxY, Math.min(maxY, panY));
    }

    function createViewer() {
        viewer = document.createElement("dialog");
        viewer.className = "ramjicart-image-viewer";
        viewer.setAttribute("aria-label", "Product image viewer");

        const stage = document.createElement("div");
        stage.className = "ramjicart-image-viewer__stage";
        viewerImage = document.createElement("img");
        viewerImage.className = "ramjicart-image-viewer__image";
        viewerImage.alt = "";
        viewerImage.draggable = false;
        viewerImage.onerror = function () {
            viewerImage.onerror = null;
            viewerImage.src = "images/food-placeholder.svg";
        };

        const closeButton = document.createElement("button");
        closeButton.className = "ramjicart-image-viewer__close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close image viewer");
        closeButton.textContent = "×";
        closeButton.addEventListener("click", closeViewer);

        previousButton = document.createElement("button");
        previousButton.className = "ramjicart-image-viewer__arrow is-previous";
        previousButton.type = "button";
        previousButton.setAttribute("aria-label", "Previous image");
        previousButton.textContent = "‹";
        previousButton.addEventListener("click", function () { moveViewerImage(-1); });

        nextButton = document.createElement("button");
        nextButton.className = "ramjicart-image-viewer__arrow is-next";
        nextButton.type = "button";
        nextButton.setAttribute("aria-label", "Next image");
        nextButton.textContent = "›";
        nextButton.addEventListener("click", function () { moveViewerImage(1); });

        imageCounter = document.createElement("span");
        imageCounter.className = "ramjicart-image-viewer__counter";
        imageCounter.setAttribute("aria-live", "polite");

        stage.append(viewerImage, previousButton, nextButton);
        const zoomControls = document.createElement("div");
        zoomControls.className = "ramjicart-image-viewer__zoom";
        const zoomOutButton = document.createElement("button");
        zoomOutButton.type = "button";
        zoomOutButton.setAttribute("aria-label", "Zoom out");
        zoomOutButton.textContent = "−";
        zoomOutButton.addEventListener("click", function () { zoomBy(-0.5); });
        const zoomInButton = document.createElement("button");
        zoomInButton.type = "button";
        zoomInButton.setAttribute("aria-label", "Zoom in");
        zoomInButton.textContent = "+";
        zoomInButton.addEventListener("click", function () { zoomBy(0.5); });
        zoomResetButton = document.createElement("button");
        zoomResetButton.type = "button";
        zoomResetButton.setAttribute("aria-label", "Reset zoom");
        zoomResetButton.textContent = "Reset";
        zoomResetButton.disabled = true;
        zoomResetButton.addEventListener("click", resetViewerZoom);
        zoomControls.append(zoomOutButton, zoomInButton, zoomResetButton);
        stage.appendChild(zoomControls);
        viewer.append(closeButton, stage, imageCounter);
        viewer.addEventListener("click", function (event) {
            if (event.target === viewer) closeViewer();
        });
        stage.addEventListener("pointerdown", function (event) {
            if (event.target !== viewerImage && event.target !== stage) return;
            stage.setPointerCapture(event.pointerId);
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (activePointers.size === 1) {
                swipeStart = { x: event.clientX, y: event.clientY };
            } else if (activePointers.size === 2) {
                const points = Array.from(activePointers.values());
                const center = pointerCenter(points[0], points[1]);
                const bounds = stage.getBoundingClientRect();
                pinchStartDistance = pointerDistance(points[0], points[1]);
                pinchStartScale = zoomScale;
                pinchImageX = (center.x - bounds.left - bounds.width / 2 - panX) / zoomScale;
                pinchImageY = (center.y - bounds.top - bounds.height / 2 - panY) / zoomScale;
                swipeStart = null;
            }
        });
        stage.addEventListener("pointermove", function (event) {
            if (!activePointers.has(event.pointerId)) return;
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const points = Array.from(activePointers.values());
            if (points.length >= 2 && pinchStartDistance > 0) {
                const center = pointerCenter(points[0], points[1]);
                const bounds = stage.getBoundingClientRect();
                zoomScale = clampZoom(
                    pinchStartScale * pointerDistance(points[0], points[1]) / pinchStartDistance
                );
                panX = center.x - bounds.left - bounds.width / 2 - pinchImageX * zoomScale;
                panY = center.y - bounds.top - bounds.height / 2 - pinchImageY * zoomScale;
                clampPan();
                applyViewerZoom();
            } else if (points.length === 1 && zoomScale > 1) {
                const previous = swipeStart;
                if (previous) {
                    panX += event.clientX - previous.x;
                    panY += event.clientY - previous.y;
                    swipeStart = { x: event.clientX, y: event.clientY };
                    clampPan();
                    applyViewerZoom();
                }
            }
        });
        function finishPointer(event) {
            const wasSinglePointer = activePointers.size === 1;
            const start = swipeStart;
            activePointers.delete(event.pointerId);
            if (wasSinglePointer && start && zoomScale === 1) {
                const distanceX = event.clientX - start.x;
                const distanceY = event.clientY - start.y;
                if (Math.abs(distanceX) > 50 && Math.abs(distanceX) > Math.abs(distanceY)) {
                    moveViewerImage(distanceX < 0 ? 1 : -1);
                }
            }
            if (activePointers.size < 2) pinchStartDistance = 0;
            swipeStart = activePointers.size === 1
                ? Array.from(activePointers.values())[0]
                : null;
        }
        stage.addEventListener("pointerup", finishPointer);
        stage.addEventListener("pointercancel", finishPointer);
        viewer.addEventListener("close", function () {
            activeImages = [];
            activePointers.clear();
            resetViewerZoom();
        });
        document.body.appendChild(viewer);
    }

    window.RamjicartImageViewer = {
        source: function (item, fallback) {
            return imageUrls(item)[0] || fallback;
        },
        bind: function (image, item) {
            const urls = imageUrls(item);
            if (!urls.length) return;
            galleries.set(image, urls);
            image.classList.add("ramjicart-image-viewer__trigger");
            image.tabIndex = 0;
            image.setAttribute("role", "button");
            image.setAttribute("aria-label", "View " + (item.name || "product") + " image");
        }
    };

    document.addEventListener("click", function (event) {
        if (!(event.target instanceof Element)) return;
        const image = event.target.closest(".ramjicart-image-viewer__trigger");
        const urls = image && galleries.get(image);
        if (!urls || !urls.length) return;
        if (!viewer) createViewer();
        activeImages = urls;
        activeIndex = 0;
        viewerImage.alt = image.alt || "";
        renderViewerImage();
        if (typeof viewer.showModal === "function") viewer.showModal();
        else viewer.setAttribute("open", "");
    });

    document.addEventListener("keydown", function (event) {
        if (event.target instanceof Element
                && event.target.closest(".ramjicart-image-viewer__trigger")
                && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            event.target.click();
            return;
        }
        if (!viewer || !viewer.open) return;
        if (event.key === "ArrowLeft") moveViewerImage(-1);
        if (event.key === "ArrowRight") moveViewerImage(1);
        if (event.key === "+" || event.key === "=") zoomBy(0.5);
        if (event.key === "-") zoomBy(-0.5);
        if (event.key === "0") resetViewerZoom();
    });

    const themeBar = document.getElementById("themeSwitcherBar");
    if (themeBar) {
        window.setAppTheme = function (theme) {
            if (theme === 0) {
                document.body.removeAttribute("data-theme");
                localStorage.removeItem("user_app_theme");
            } else {
                document.body.setAttribute("data-theme", String(theme));
                localStorage.setItem("user_app_theme", String(theme));
            }
        };
        themeBar.addEventListener("click", function (event) {
            const button = event.target.closest("[data-theme-choice]");
            if (button) window.setAppTheme(Number(button.dataset.themeChoice));
        });
        window.setAppTheme(Number(localStorage.getItem("user_app_theme") || "1"));
    }
})();
