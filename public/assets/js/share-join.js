(function () {
    'use strict';

    const roomId = document.body.dataset.roomId;
    const status = document.getElementById('share-join-status');

    function setStatus(message) {
        if (status) status.textContent = message;
    }

    function cleanRoomUrl() {
        return `/room/${encodeURIComponent(roomId)}`;
    }

    function getInviteToken() {
        const query = new URLSearchParams(window.location.search);
        const queryToken = query.get('t');
        if (queryToken) return queryToken;

        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        return params.get('t');
    }

    async function exchangeToken(token) {
        const res = await fetch(`/room/${encodeURIComponent(roomId)}/join-token`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        if (!res.ok) throw new Error('join_token_failed');
    }

    async function start() {
        const token = getInviteToken();
        if (!roomId || !token) {
            window.location.replace('/');
            return;
        }

        try {
            setStatus('Verifying invite...');
            await exchangeToken(token);
            window.history.replaceState(window.history.state, '', cleanRoomUrl());
            window.location.replace(cleanRoomUrl());
        } catch {
            setStatus('This invite is invalid or expired.');
            setTimeout(() => window.location.replace('/'), 1800);
        }
    }

    start();
})();
