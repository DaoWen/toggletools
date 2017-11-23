(function() {
    'use strict';

    ////////////////////////

    const triggerLocationChanged = function () {
        var ev = new Event('location_changed');
        ev.arguments = arguments;
        window.dispatchEvent(ev);
        return true;
    };

    // monkey-patching push/replace state functions to catch the event
    ['pushState', 'replaceState'].forEach(function (fn) {
        const origFn = history[fn];
        history[fn] = function(state, title, url) {
            const retval = origFn.apply(this, arguments);
            triggerLocationChanged.apply(window, arguments);
            return retval;
        };
    });

    window.addEventListener('popstate', triggerLocationChanged);

    //////////////////////////

    window.waitUntil = function(predicate, maxRetries = 100, pauseMillis = 200) {
        return new Promise(function (resolve, reject) {
            var retries = maxRetries;
            const inner = function() {
                const predResult = predicate();
                if (predResult) {
                    resolve(predResult);
                }
                else if (--retries >= 0) {
                    setTimeout(inner, pauseMillis);
                }
                else {
                    reject("Retry limit exceeded");
                }
            };
            inner();
        });
    };

    // Action that will retry until it is successful
    window.InsistentAction = class InsistentAction {
        constructor(action) {
            this._action = action;
        }
        reset() {
            this._promise = null;
        }
        activate() {
            if (!this._promise) {
                this._promise = waitUntil(this._action);
                // TODO - use promise.finally to call reset()
                // (promise.finally is coming to chrome in version 43)
                this._promise.then((result) => {
                    this.reset();
                }).catch((error) => {
                    this.reset();
                    console.debug(`InsistentAction aborted: ${error.message}`);
                });
            }
            return this._promise;
        }
    };

    window.onlyForURL = (urlPattern) => () => urlPattern.test(window.location.href);

    window.notForURL = (urlPattern) => () => !urlPattern.test(window.location.href);

    window.doOnLocationChange = function(targetSelector, action, filter) {
        var oldTarget;
        const wrappedAction = function () {
            const $target = $(targetSelector);
            if ($target.length && $target[0] !== oldTarget) {
                oldTarget = $target[0];
                action($target);
            }
        };
        const insistent = new InsistentAction(wrappedAction);
        const filteredAction = function() {
            if (!filter || filter()) {
                insistent.activate();
            }
        };
        window.addEventListener('location_changed', filteredAction);
        filteredAction();
    };
})();
