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
                        <a href="login.html" id="accountLink">Sign in</a>
                        <section id="customerProfile" aria-label="Customer profile" hidden>
                            <h2>Your profile</h2>
                            <div class="customer-profile-grid">
                                <div class="customer-profile-field"><span>Name</span><strong id="customerProfileName"></strong></div>
                                <div class="customer-profile-field"><span>Email</span><strong id="customerProfileEmail"></strong></div>
                                <div class="customer-profile-field"><span>Phone</span><strong id="customerProfilePhone"></strong></div>
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
                <div id="themeSwitcherBar" hidden style="position:fixed;bottom:calc(92px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:90;background:rgba(12,8,28,0.94);border:1px solid rgba(255,138,92,0.45);border-radius:30px;padding:6px 12px;display:flex;align-items:center;gap:6px;box-shadow:0 8px 30px rgba(0,0,0,0.6);backdrop-filter:blur(10px);max-width:calc(100vw - 20px);overflow-x:auto;-webkit-overflow-scrolling:touch;">
                    <span style="color:#ff8a5c;font-size:12px;font-weight:bold;white-space:nowrap;margin-right:2px;">&#127912; Select Color:</span>
                    <button type="button" data-theme-choice="1" style="border:none;background:#231742;color:#fff;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid #7c3aed;">1: Cosmic Glass</button>
                    <button type="button" data-theme-choice="2" style="border:none;background:#0f172a;color:#fff;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid #3b82f6;">2: Midnight Slate</button>
                    <button type="button" data-theme-choice="3" style="border:none;background:#18181b;color:#fff;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid #71717a;">3: Charcoal</button>
                    <button type="button" data-theme-choice="4" style="border:none;background:#f3f0ff;color:#1e1b4b;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid #a78bfa;">4: Milky Pearl</button>
                    <button type="button" data-theme-choice="5" style="border:none;background:#241224;color:#fed7aa;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid #f97316;">5: Sunset Amber</button>
                    <button type="button" data-theme-choice="0" style="border:none;background:#fff;color:#111;padding:6px 10px;border-radius:15px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Original White</button>
                </div>
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
