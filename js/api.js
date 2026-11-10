(function () {
    "use strict";

    const ACCESS_TOKEN_KEY = "ramjicart.accessToken";
    const REFRESH_TOKEN_KEY = "ramjicart.refreshToken";
    const CART_KEY = "ramjicart-cart";
    const originalFetch = window.fetch.bind(window);
    const apiBase = String(API_BASE || "").replace(/\/+$/, "");
    const menuCachePrefix = "ramjicart:menu:";
    let refreshPromise = null;

    if (!apiBase) {
        throw new Error("Set API_BASE in js/config.js before using the API.");
    }

    function apiPath(input) {
        const url = new URL(input instanceof Request ? input.url : input, window.location.href);
        return url.pathname.startsWith("/api/") ? url.pathname + url.search : null;
    }

    function requiresAuth(path) {
        return !(
            path === "/api/config/public"
            || path === "/api/auth/login"
            || path === "/api/auth/register"
            || path === "/api/restaurant/register"
            || path === "/api/delivery/register"
            || path.startsWith("/api/certificate/verify/")
            || path.startsWith("/api/customer/categories")
            || path.startsWith("/api/customer/foods")
            || path.startsWith("/api/customer/restaurants")
            || path === "/api/payments/cashfree/webhook"
        );
    }

    function responseJson(payload, status) {
        return new Response(JSON.stringify(payload), {
            status: status,
            headers: { "Content-Type": "application/json" }
        });
    }

    function readCart() {
        const raw = localStorage.getItem(CART_KEY);
        if (!raw) return [];
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) throw new Error("Your saved cart could not be read.");
        return items;
    }

    function cartResponse(items) {
        const itemTotal = items.reduce(function (total, item) {
            return total + Number(item.price || 0) * Number(item.quantity || 0);
        }, 0);
        return responseJson({
            items: items,
            itemTotal: Number(itemTotal.toFixed(2)),
            deliveryFee: 0,
            discount: 0,
            total: Number(itemTotal.toFixed(2))
        }, 200);
    }

    function cachedFoods() {
        const foods = [];
        for (let index = 0; index < sessionStorage.length; index += 1) {
            const key = sessionStorage.key(index);
            if (!key || !key.startsWith(menuCachePrefix)) continue;
            const path = key.slice(menuCachePrefix.length);
            const cached = JSON.parse(sessionStorage.getItem(key));
            const data = cached && cached.data;
            if (Array.isArray(data)
                    && /^\/api\/customer\/foods(?:\/popular)?(?:\?|$)/.test(path)) {
                foods.push.apply(foods, data);
            }
            if (data && Array.isArray(data.shops)) {
                data.shops.forEach(function (shop) {
                    (shop.items || []).forEach(function (food) {
                        foods.push(Object.assign({ restaurantId: shop.id, restaurantName: shop.name }, food));
                    });
                });
            }
        }
        return foods;
    }

    async function findFood(foodId) {
        let food = cachedFoods().find(function (item) {
            return String(item.id) === String(foodId);
        });
        if (food) return food;

        const response = await window.fetch("/api/customer/foods");
        if (!response.ok) throw new Error("Item details could not be loaded. Please reload the menu.");
        const foods = await response.json();
        food = foods.find(function (item) {
            return String(item.id) === String(foodId);
        });
        if (!food) throw new Error("This item is no longer available.");
        return food;
    }

    async function localCart(path, init) {
        const method = String((init && init.method) || "GET").toUpperCase();
        const parts = path.split("?")[0].split("/").filter(Boolean);
        const itemId = parts.length > 3 ? decodeURIComponent(parts[3]) : null;
        let items = readCart();

        if (method === "GET" && !itemId) return cartResponse(items);

        if (method === "POST" && !itemId) {
            const payload = JSON.parse((init && init.body) || "{}");
            const foodId = payload.foodId || payload.itemId || payload.id;
            if (!foodId) return responseJson({ detail: "Choose an item to add to your cart." }, 400);
            const food = await findFood(foodId);
            const variant = (food.variants || []).find(function (option) {
                return String(option.id) === String(payload.variantId || "")
                    || String(option.name) === String(payload.variantName || "");
            });
            if ((food.variants || []).length && !variant) {
                return responseJson({ detail: "Choose a valid item variant." }, 400);
            }
            const addonIds = Array.isArray(payload.addonIds) ? payload.addonIds.map(String) : [];
            const addons = addonIds.map(function (id) {
                return (food.addons || []).find(function (option) {
                    return String(option.id) === id;
                });
            });
            if (addons.some(function (addon) { return !addon; })) {
                return responseJson({ detail: "An add-on is no longer available." }, 400);
            }
            const quantity = Number(payload.quantity || 1);
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99) {
                return responseJson({ detail: "Enter a valid quantity." }, 400);
            }
            const restaurantId = food.restaurantId || food.restaurant_id || null;
            if (items.length && restaurantId && items[0].restaurantId
                    && String(items[0].restaurantId) !== String(restaurantId)) {
                return responseJson({
                    detail: "Please finish or clear the current restaurant's cart first."
                }, 400);
            }
            const basePrice = variant ? Number(variant.price) : Number(food.price || 0);
            const addonPrice = addons.reduce(function (total, addon) {
                return total + Number(addon.price || 0);
            }, 0);
            const key = [food.id, variant ? variant.id : "", addonIds.slice().sort().join(",")].join(":");
            const existing = items.find(function (item) { return item.id === key; });
            if (existing) existing.quantity = Number((Number(existing.quantity) + quantity).toFixed(2));
            else {
                items.push({
                    id: key,
                    foodId: food.id,
                    name: food.name,
                    description: food.description || "",
                    image: food.image || "",
                    images: Array.isArray(food.images) ? food.images.slice() : [],
                    price: Number((basePrice + addonPrice).toFixed(2)),
                    quantity: quantity,
                    quantityUnit: food.quantityUnit || "piece",
                    foodType: food.foodType || "",
                    restaurantId: restaurantId,
                    restaurantName: food.restaurantName || "",
                    variantId: variant ? variant.id : "",
                    variantName: variant ? variant.name : "",
                    addonIds: addonIds,
                    addons: addons.map(function (addon) {
                        return { id: addon.id, name: addon.name, price: addon.price };
                    })
                });
            }
        } else if (method === "PUT" && itemId) {
            const payload = JSON.parse((init && init.body) || "{}");
            const item = items.find(function (entry) { return entry.id === itemId; });
            const quantity = Number(payload.quantity);
            if (!item) return responseJson({ detail: "Cart item was not found." }, 404);
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 99) {
                return responseJson({ detail: "Enter a valid quantity." }, 400);
            }
            item.quantity = Number(quantity.toFixed(2));
        } else if (method === "DELETE" && itemId) {
            items = items.filter(function (item) { return item.id !== itemId; });
        } else {
            return responseJson({ detail: "Cart operation is not supported." }, 405);
        }

        localStorage.setItem(CART_KEY, JSON.stringify(items));
        const result = await cartResponse(items).json();
        document.dispatchEvent(new CustomEvent("ramjicart:cart-updated", { detail: result }));
        return responseJson(result, 200);
    }

    function requestInit(input, init, token) {
        const source = input instanceof Request ? input : null;
        const options = Object.assign({}, source ? {
            method: source.method,
            headers: source.headers,
            body: source.method === "GET" || source.method === "HEAD" ? undefined : source.clone().body,
            signal: source.signal
        } : {}, init || {});
        const headers = new Headers(options.headers || {});
        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", "Bearer " + token);
        }
        options.headers = headers;
        options.credentials = "omit";
        return options;
    }

    async function fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeout = window.setTimeout(function () { controller.abort(); }, 15000);
        if (options.signal) {
            if (options.signal.aborted) controller.abort();
            else options.signal.addEventListener("abort", function () { controller.abort(); }, { once: true });
        }
        try {
            return await originalFetch(url, Object.assign({}, options, { signal: controller.signal }));
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("The server took too long to respond. Please try again.");
            }
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }
    }

    async function refreshTokens() {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return false;
        if (!refreshPromise) {
            refreshPromise = fetchWithTimeout(apiBase + "/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh: refreshToken }),
                credentials: "omit"
            }).then(async function (response) {
                if (!response.ok) return false;
                const tokens = await response.json();
                localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
                return true;
            }).catch(function () {
                return false;
            }).finally(function () {
                refreshPromise = null;
            });
        }
        return refreshPromise;
    }

    function cacheMenuResponse(path, response) {
        const isMenuPath = /^\/api\/customer\/(?:foods(?:\/popular)?|categories(?:\/[^/?]+)?|restaurants(?:\/[^/?]+)?)(?:\?|$)/.test(path);
        if (response.ok && isMenuPath) {
            response.clone().json().then(function (data) {
                sessionStorage.setItem(menuCachePrefix + path, JSON.stringify({
                    savedAt: Date.now(),
                    data: data
                }));
            }).catch(function () {});
        }
    }

    async function apiFetch(input, init) {
        const path = apiPath(input);
        if (!path) return originalFetch(input, init);
        if (path === "/api/customer/cart" || path.startsWith("/api/customer/cart/")) {
            try {
                return await localCart(path, init);
            } catch (error) {
                return responseJson({ detail: error.message || "Cart could not be updated." }, 400);
            }
        }

        const method = String((init && init.method) || (input instanceof Request ? input.method : "GET")).toUpperCase();
        const cacheKey = menuCachePrefix + path;
        if (method === "GET" && path.startsWith("/api/customer/")) {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const entry = JSON.parse(cached);
                if (Date.now() - entry.savedAt < 5 * 60 * 1000) {
                    return responseJson(entry.data, 200);
                }
            }
        }

        const token = requiresAuth(path) ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
        const url = apiBase + path.slice(4);
        let response;
        try {
            response = await fetchWithTimeout(url, requestInit(input, init, token));
            if (response.status === 401 && requiresAuth(path)
                    && !path.includes("auth/refresh") && !path.includes("auth/logout")) {
                if (token && await refreshTokens()) {
                    response = await fetchWithTimeout(
                        url,
                        requestInit(input, init, localStorage.getItem(ACCESS_TOKEN_KEY))
                    );
                } else if (token || path !== "/api/auth/me") {
                    localStorage.removeItem(ACCESS_TOKEN_KEY);
                    localStorage.removeItem(REFRESH_TOKEN_KEY);
                    if (!window.location.pathname.endsWith("login.html")) {
                        window.location.assign("login.html");
                    }
                }
            }
        } catch (error) {
            return responseJson({ detail: error.message || "Could not connect to the server." }, 503);
        }

        if (response.ok && path.endsWith("auth/logout")) {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        if (response.ok && (path.endsWith("auth/login") || path.endsWith("auth/refresh"))) {
            const tokens = await response.clone().json().catch(function () { return null; });
            if (tokens && tokens.accessToken && tokens.refreshToken) {
                localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
            }
        }
        cacheMenuResponse(path, response);
        return withClientErrorMessage(response);
    }

    async function download(path, filename) {
        const response = await apiFetch(path);
        if (!response.ok) {
            const error = await response.json().catch(function () { return {}; });
            throw new Error(error.detail || "The file could not be downloaded.");
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
    }

    async function withClientErrorMessage(response) {
        const contentType = response.headers.get("Content-Type") || "";
        if (response.ok || !contentType.includes("application/json")) return response;
        const payload = await response.clone().json().catch(function () { return null; });
        if (!payload || !payload.detail || payload.message) return response;
        payload.message = payload.detail;
        const headers = new Headers(response.headers);
        headers.delete("Content-Length");
        return new Response(JSON.stringify(payload), {
            status: response.status,
            statusText: response.statusText,
            headers: headers
        });
    }

    window.fetch = apiFetch;
    window.RamjicartAPI = Object.freeze({
        fetch: apiFetch,
        download: download,
        accessTokenKey: ACCESS_TOKEN_KEY,
        refreshTokenKey: REFRESH_TOKEN_KEY
    });
})();
