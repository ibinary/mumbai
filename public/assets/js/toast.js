(function () {
    'use strict';

    function ensureRoot() {
        let root = document.getElementById('toast-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'toast-root';
            root.setAttribute('aria-live', 'polite');
            root.setAttribute('aria-atomic', 'true');
            document.body.appendChild(root);
        }
        return root;
    }

    function show(kind, message, opts) {
        const root = ensureRoot();
        const el = document.createElement('div');
        el.className = 'toast toast--' + kind;
        el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        el.textContent = String(message || '');
        root.appendChild(el);

        const ttl = (opts && opts.ttl) || (kind === 'error' ? 6000 : 3500);
        setTimeout(() => {
            el.classList.add('toast--leaving');
            setTimeout(() => el.remove(), 250);
        }, ttl);
    }

    window.toast = {
        info: (m, o) => show('info', m, o),
        success: (m, o) => show('success', m, o),
        error: (m, o) => show('error', m, o),
    };
})();
