(function() {
    // 1. Clear MUI Filters (Existing logic)
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

    // 2. Simplified Promo Hider: Targets ONLY the specific div
    function hidePromoDiv(nodes) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!node || node.nodeType !== 1) continue;

            // Selector matches any div where the data-sentry-component contains "PromoTile"
            var selector = 'div[data-sentry-component*="PromoTile"]';
            var targets = [];
            
            if (node.matches && node.matches(selector)) { targets.push(node); }
            var found = node.querySelectorAll ? node.querySelectorAll(selector) : [];
            for (var j = 0; j < found.length; j++) { targets.push(found[j]); }

            for (var k = 0; k < targets.length; k++) {
                // Hide only the element itself, no climbing
                targets[k].style.setProperty('display', 'none', 'important');
            }
        }
    }

    // 3. Unblock pointer-events logic (Existing logic)
    function unblockPointerEvents(elements) {
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (el.nodeType === 1 && typeof el.className === 'string' && /mui/i.test(el.className)) {
                var computedStyle = window.getComputedStyle(el);
                if (computedStyle.pointerEvents === 'none') {
                    el.style.setProperty('pointer-events', 'auto', 'important');
                }
            }
        }
    }

    // Initial pass
    unblockPointerEvents(document.querySelectorAll('[class^="mui"], [class*=" mui"]'));
    hidePromoDiv([document.body]);

    // 4. MutationObserver for dynamic updates
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        unblockPointerEvents([node]);
                        var childMui = node.querySelectorAll('[class^="mui"], [class*=" mui"]');
                        if (childMui.length > 0) { unblockPointerEvents(childMui); }
                        
                        // Check specifically for PromoTiles in new content
                        hidePromoDiv([node]); 
                    }
                });
            } else if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'data-sentry-component')) {
                unblockPointerEvents([mutation.target]);
                hidePromoDiv([mutation.target]);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-sentry-component']
    });

    console.log('Script Active: Precision PromoTile Hiding active.');
})();