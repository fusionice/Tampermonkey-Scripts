// ==UserScript==
// @name         Boldin.com - Aggressive Fixer
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Aggressively hides PromoTiles and clears MUI blocks on Boldin.com
// @author       Gemini
// @match        *://*.boldin.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 1. Existing Logic: Clear MUI Filters & Pointer Events
    // ==========================================
    var css = '[class^="mui"], [class*=" mui"] { filter: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } ' +
        '[class^="mui"]::before, [class*=" mui"]::before, [class^="mui"]::after, [class*=" mui"]::after { content: none !important; filter: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
    var styleOverride = document.createElement('style');
    styleOverride.type = 'text/css';
    if (styleOverride.styleSheet) {
        styleOverride.styleSheet.cssText = css;
    } else {
        styleOverride.appendChild(document.createTextNode(css));
    }
    document.head.appendChild(styleOverride);

    function hidePromoDiv(nodes) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!node || node.nodeType !== 1) continue;

            var selector = 'div[data-sentry-component*="PromoTile"]';
            var targets = [];

            if (node.matches && node.matches(selector)) { targets.push(node); }
            var found = node.querySelectorAll ? node.querySelectorAll(selector) : [];
            for (var j = 0; j < found.length; j++) { targets.push(found[j]); }

            for (var k = 0; k < targets.length; k++) {
                targets[k].style.setProperty('display', 'none', 'important');
            }
        }
    }

    function unblockPointerEvents(elements) {
        // Disabled: Forcing pointer-events to 'auto' on all .mui elements breaks interaction
        // with standard text fields, inputs, and floating labels in Material-UI.
    }

    // ==========================================
    // 2. New Logic: Coach Suggestions Unlocker
    // ==========================================
    let TITLE_TO_KEY = {};

    function normalizeText(text) {
        return (text || "").replace(/[\u2018\u2019\u00b4'`]/g, "'").trim();
    }

    function getFiber(el) {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
        return key ? el[key] : null;
    }

    function unlockSuggestions() {
        const todoRegion = document.querySelector('div[aria-labelledby="coach-suggestions-to-do"]');
        if (!todoRegion) return;

        if (Object.keys(TITLE_TO_KEY).length === 0) {
            let listFiber = getFiber(todoRegion);
            while (listFiber) {
                if (listFiber.memoizedProps) {
                    for (const key in listFiber.memoizedProps) {
                        const val = listFiber.memoizedProps[key];
                        if (Array.isArray(val) && val.length > 0 && val[0].auditItemKey && val[0].alertTitle) {
                            val.forEach(suggestion => {
                                TITLE_TO_KEY[normalizeText(suggestion.alertTitle)] = suggestion.auditItemKey;
                            });
                        }
                    }
                }
                if (Object.keys(TITLE_TO_KEY).length > 0) break;
                listFiber = listFiber.return;
            }
        }

        const todoItems = todoRegion.querySelectorAll('[data-sentry-component="CoachListItem"]');
        let newlyUnlockedCount = 0;
        let firstAuditKey = null;

        todoItems.forEach((item, index) => {
            if (item.dataset.unlocked === "true") {
                if (index === 0) {
                    const itemText = normalizeText(item.textContent);
                    for (const [title, key] of Object.entries(TITLE_TO_KEY)) {
                        if (itemText.includes(normalizeText(title))) {
                            firstAuditKey = key;
                            break;
                        }
                    }
                }
                return;
            }

            item.dataset.unlocked = "true";

            item.style.pointerEvents = 'auto';
            item.style.cursor = 'pointer';
            item.style.opacity = '1';

            const innerBox = item.querySelector('.MuiBox-root');
            if (innerBox) {
                innerBox.style.pointerEvents = 'auto';
                innerBox.style.opacity = '1';
            }

            const lockIcon = item.querySelector('[data-testid="LockIcon"]');
            if (lockIcon) lockIcon.style.display = 'none';

            const itemText = normalizeText(item.textContent);
            let auditItemKey = null;

            for (const [title, key] of Object.entries(TITLE_TO_KEY)) {
                if (itemText.includes(normalizeText(title))) {
                    auditItemKey = key;
                    break;
                }
            }

            if (auditItemKey) {
                if (index === 0) firstAuditKey = auditItemKey;
                newlyUnlockedCount++;

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.next && window.next.router) {
                        window.next.router.push(`/planner/coach/${auditItemKey}`, undefined, { shallow: true });
                    } else {
                        window.location.href = `/planner/coach/${auditItemKey}`;
                    }
                }, true);
            }
        });

        if (newlyUnlockedCount > 0 && firstAuditKey) {
            if (!window.location.pathname.includes(firstAuditKey)) {
                if (window.next && window.next.router) {
                    window.next.router.push(`/planner/coach/${firstAuditKey}`, undefined, { shallow: true });
                } else {
                    window.location.href = `/planner/coach/${firstAuditKey}`;
                }
            }
        }
    }

    // ==========================================
    // 3. Initialization & Observer
    // ==========================================
    unblockPointerEvents(document.querySelectorAll('[class^="mui"], [class*=" mui"]'));
    hidePromoDiv([document.body]);

    // Initial pass for coach suggestions
    if (window.location.pathname.includes('/planner/coach')) {
        unlockSuggestions();
    }

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) {
                        unblockPointerEvents([node]);
                        var childMui = node.querySelectorAll('[class^="mui"], [class*=" mui"]');
                        if (childMui.length > 0) { unblockPointerEvents(childMui); }

                        hidePromoDiv([node]);
                    }
                });
            } else if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'data-sentry-component')) {
                unblockPointerEvents([mutation.target]);
                hidePromoDiv([mutation.target]);
            }
        });

        // Debounce the Coach Suggestions logic so it doesn't run hundreds of times per render
        if (window.unlockTimeout) clearTimeout(window.unlockTimeout);
        window.unlockTimeout = setTimeout(() => {
            if (window.location.pathname.includes('/planner/coach')) {
                unlockSuggestions();
            }
        }, 150);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-sentry-component']
    });

    // ==========================================
    // 4. Targeted Chart Fix (UpgradeOverlay)
    // ==========================================
    const targetedSelector = `
        div[data-sentry-component="UpgradeOverlay"] .recharts-responsive-container, 
        div[data-sentry-component="UpgradeOverlay"] .recharts-wrapper, 
        div[data-sentry-component="UpgradeOverlay"] .nrchart-parent-wrapper
    `;

    const applyFix = () => {
        const chartElements = document.querySelectorAll(targetedSelector);

        chartElements.forEach(el => {
            // Ensure the chart is interactive
            el.style.setProperty('pointer-events', 'auto', 'important');

            // Bring chart to the absolute front within its container
            el.style.setProperty('z-index', '2147483647', 'important');

            // Mask underlying elements with a solid white background
            el.style.setProperty('background-color', 'white', 'important');

            // Force relative positioning so z-index is respected
            if (getComputedStyle(el).position === 'static') {
                el.style.setProperty('position', 'relative', 'important');
            }
        });
    };

    applyFix();
    setInterval(applyFix, 1000);

    console.log('Boldin Enhancements Script Active: Promo Hiding, Coach Unlocking & Targeted Chart Fix.');
})();
