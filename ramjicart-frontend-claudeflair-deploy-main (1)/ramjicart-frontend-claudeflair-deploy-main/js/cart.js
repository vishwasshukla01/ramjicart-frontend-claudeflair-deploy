(function () {
    "use strict";

    const CART_KEY = "ramjicart-cart";

    function items() {
        const saved = localStorage.getItem(CART_KEY);
        if (!saved) return [];
        const cart = JSON.parse(saved);
        if (!Array.isArray(cart)) throw new Error("Your saved cart could not be read.");
        return cart;
    }

    function add(food, quantity, options) {
        const selection = options || {};
        const payload = {
            foodId: food.id,
            quantity: quantity || 1,
            variantId: selection.variantId || "",
            variantName: selection.variantName || "",
            addonIds: selection.addonIds || []
        };
        return window.fetch("/api/customer/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(async function (response) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Could not add this item.");
            return data;
        });
    }

    function clear() {
        localStorage.removeItem(CART_KEY);
        document.dispatchEvent(new CustomEvent("ramjicart:cart-updated", {
            detail: { items: [] }
        }));
    }

    window.RamjicartCart = Object.freeze({
        items: items,
        add: add,
        clear: clear
    });
})();
