(function () {
    "use strict";

    const fallbackCategories = [
        ["Groceries", "groceries", "🛒", "#e8f5e9"],
        ["Fast Food", "fast-food", "🍔", "#fff0e6"],
        ["Drinks & Juice", "drinks-juice", "🥤", "#e8f4ff"],
        ["Fruits", "fruits", "🍎", "#fff1ef"],
        ["Vegetables", "vegetables", "🥦", "#edf7e9"],
        ["Stationery", "stationery", "✏️", "#f1edff"],
        ["Other", "other", "🧺", "#f2f4f7"]
    ].map(function (item, index) {
        return { id: index + 1, name: item[0], slug: item[1], icon: item[2], color: item[3] };
    });
    const slug = new URLSearchParams(location.search).get("slug")
        || location.pathname.split("/").filter(Boolean).pop()
        || "groceries";
    const title = document.getElementById("title");
    const shopsElement = document.getElementById("shops");
    const message = document.getElementById("message");
    const search = document.getElementById("search");
    const sort = document.getElementById("sort");
    const veg = document.getElementById("veg");
    const open = document.getElementById("open");
    const rating = document.getElementById("rating");
    let categoryData = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function foodImage(url, alt, food) {
        const image = element("img");
        image.loading = "lazy";
        image.alt = alt || "";
        image.src = url || "images/food-placeholder.svg";
        if (food) {
            image.src = window.RamjicartImageViewer.source(food, "images/food-placeholder.svg");
            window.RamjicartImageViewer.bind(image, food);
        }
        image.onerror = function () {
            image.onerror = null;
            image.src = "images/food-placeholder.svg";
        };
        return image;
    }

    function renderTabs(categories) {
        const tabs = document.getElementById("tabs");
        tabs.replaceChildren();
        categories.forEach(function (category) {
            const link = element(
                "a",
                category.slug === slug ? "active" : "",
                (category.icon || "🛍️") + " " + category.name
            );
            link.href = "category.html?slug=" + encodeURIComponent(category.slug);
            tabs.appendChild(link);
        });
        const current = categories.find(function (category) {
            return category.slug === slug;
        }) || categories[0];
        if (!current) return;
        document.getElementById("heroIcon").textContent = current.icon || "🛍️";
        document.getElementById("heroIcon").style.backgroundColor =
            CSS.supports("background-color", current.color) ? current.color : "#fff3e8";
        title.textContent = current.name;
        document.getElementById("crumbName").textContent = current.name;
        document.title = current.name + " shops & products | Ramjicart";
        document.querySelector('meta[name="description"]').content =
            "Shop " + current.name.toLowerCase() + " from nearby Ramjicart stores.";
        veg.hidden = slug !== "fast-food";
    }

    function createItemOptions(food, info) {
        let variantSelect = null;
        let selectedQuantity = 1;
        const addonInputs = [];
        if (Array.isArray(food.variants) && food.variants.length) {
            variantSelect = element("select", "size-picker");
            variantSelect.setAttribute("aria-label", "Choose an item variant");
            variantSelect.appendChild(new Option("Choose an option", ""));
            food.variants.forEach(function (variant) {
                variantSelect.add(new Option(
                    variant.name + " — ₹" + Number(variant.price).toFixed(2),
                    variant.id
                ));
            });
            info.appendChild(variantSelect);
        } else if (food.quantityUnit === "kg") {
            const quantity = element("input", "size-picker");
            quantity.type = "number";
            quantity.min = "0.05";
            quantity.step = "0.01";
            quantity.value = "1";
            quantity.setAttribute("aria-label", "Quantity in kilograms");
            const unit = element("select", "size-picker");
            unit.add(new Option("kg", "1"));
            unit.add(new Option("g", "0.001"));
            const price = element("p", "price", "₹" + Number(food.price).toFixed(2));
            const updateQuantity = function () {
                selectedQuantity = Math.round(
                    Number(quantity.value || 0) * Number(unit.value) * 100
                ) / 100;
                price.textContent = "₹" + (
                    Math.round(Number(food.price) * selectedQuantity * 100) / 100
                ).toFixed(2);
            };
            quantity.addEventListener("input", updateQuantity);
            unit.addEventListener("change", function () {
                quantity.min = unit.value === "0.001" ? "50" : "0.05";
                quantity.step = unit.value === "0.001" ? "1" : "0.01";
                updateQuantity();
            });
            const quickQuantities = element("div", "quick-quantities");
            [[250, "g"], [500, "g"], [1, "kg"], [2, "kg"]].forEach(function (choice) {
                const button = element("button", "add", choice[0] + " " + choice[1]);
                button.type = "button";
                button.addEventListener("click", function () {
                    quantity.value = choice[0];
                    unit.value = choice[1] === "g" ? "0.001" : "1";
                    unit.dispatchEvent(new Event("change"));
                    updateQuantity();
                });
                quickQuantities.appendChild(button);
            });
            info.append(
                element("p", "", "Aapko kitna chahiye?"),
                quantity,
                unit,
                quickQuantities,
                price
            );
        }

        (food.addons || []).forEach(function (addon) {
            const label = element("label", "food-addon-option");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = addon.id;
            label.append(
                checkbox,
                element("span", "", addon.name + " (+₹" + Number(addon.price).toFixed(2) + ")")
            );
            info.appendChild(label);
            addonInputs.push(checkbox);
        });
        return {
            variantSelect: variantSelect,
            addonInputs: addonInputs,
            quantity: function () { return selectedQuantity; }
        };
    }

    function render() {
        if (!categoryData) return;
        const query = search.value.trim().toLowerCase();
        let shops = categoryData.shops.map(function (shop) {
            return Object.assign({}, shop, {
                items: shop.items.filter(function (food) {
                    return (!query || (
                        food.name + " " + (food.description || "") + " " + shop.name
                    ).toLowerCase().includes(query))
                        && (veg.value !== "veg" || food.veg);
                })
            });
        }).filter(function (shop) {
            return shop.items.length
                && (open.value !== "open" || shop.open)
                && (rating.value === "all" || Number(shop.rating) >= Number(rating.value));
        });
        if (sort.value === "price") {
            shops.forEach(function (shop) {
                shop.items.sort(function (a, b) { return a.price - b.price; });
            });
        } else if (sort.value === "rating") {
            shops.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
        }

        shopsElement.replaceChildren();
        if (!shops.length) {
            message.hidden = false;
            message.className = "empty";
            message.textContent = "Abhi is category mein koi shop nahi hai";
            return;
        }
        message.hidden = true;
        shops.forEach(function (shop) {
            const card = element("article", "shop");
            const heading = element("div", "shop-head");
            heading.appendChild(foodImage(shop.photo, shop.name));
            const shopInfo = element("div", "shop-meta");
            shopInfo.append(
                element("h2", "", shop.name),
                element("div", "sub",
                    (shop.rating ? "★ " + shop.rating + " · " : "")
                    + (shop.deliveryTime || "30–45 min") + " delivery")
            );
            heading.append(
                shopInfo,
                element("span", "status" + (shop.open ? "" : " closed"),
                    shop.open ? "Open" : "Closed")
            );
            const items = element("div", "items");
            shop.items.forEach(function (food) {
                const row = element("article", "product");
                row.appendChild(foodImage(food.image, food.name, food));
                const info = element("div", "product-info");
                info.append(
                    element("h3", "", food.name),
                    element("p", "", food.description || "")
                );
                const options = createItemOptions(food, info);
                if (!options.variantSelect && food.quantityUnit !== "kg") {
                    info.appendChild(element("span", "price", "₹" + Number(food.price).toFixed(2)));
                }
                const add = element("button", "add", shop.open ? "Add to Cart" : "Closed");
                add.type = "button";
                add.disabled = !shop.open;
                add.addEventListener("click", async function () {
                    if (options.variantSelect && !options.variantSelect.value) {
                        message.hidden = false;
                        message.className = "empty";
                        message.textContent = "Choose an item variant first.";
                        return;
                    }
                    add.disabled = true;
                    try {
                        await RamjicartCart.add(food, options.quantity(), {
                            variantId: options.variantSelect ? options.variantSelect.value : "",
                            addonIds: options.addonInputs.filter(function (input) {
                                return input.checked;
                            }).map(function (input) { return input.value; })
                        });
                        add.textContent = "Added ✓";
                        window.setTimeout(function () {
                            add.textContent = "Add to Cart";
                            add.disabled = false;
                        }, 1200);
                    } catch (error) {
                        message.hidden = false;
                        message.className = "empty";
                        message.textContent = error.message || "Could not add this item.";
                        add.disabled = false;
                    }
                });
                row.append(info, add);
                items.appendChild(row);
            });
            heading.addEventListener("click", function () { items.hidden = !items.hidden; });
            card.append(heading, items);
            shopsElement.appendChild(card);
        });
    }

    async function init() {
        const slugParam = encodeURIComponent(slug);
        try {
            const [categoriesResponse, categoryResponse] = await Promise.all([
                fetch("/api/customer/categories"),
                fetch("/api/customer/categories/" + slugParam)
            ]);
            const categories = categoriesResponse.ok
                ? await categoriesResponse.json()
                : fallbackCategories;
            renderTabs(categories.length ? categories : fallbackCategories);
            const result = await categoryResponse.json();
            if (!categoryResponse.ok) throw new Error(result.detail || "Category could not be loaded.");
            categoryData = result;
            render();
        } catch (error) {
            message.hidden = false;
            message.className = "empty";
            message.textContent = error.message || "Category could not be loaded.";
        }
        [search, sort, veg, open, rating].forEach(function (control) {
            control.addEventListener("input", render);
            control.addEventListener("change", render);
        });
    }

    init();
})();
