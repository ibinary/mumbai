(function () {
    'use strict';

    const form = document.getElementById('home-form');
    const input = document.getElementById('room-id');
    const createBtn = document.getElementById('create-room');

    function normalizeRoomId(v) {
        return String(v || '').trim();
    }

    async function createRoom(e) {
        e.preventDefault();
        const roomId = normalizeRoomId(input.value);
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(roomId)) {
            window.toast &&
                window.toast.error('Room name must be 1-32 letters, numbers, "_" or "-".');
            input.focus();
            return;
        }
        createBtn.disabled = true;
        try {
            const response = await fetch('/room/' + encodeURIComponent(roomId), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            if (response.ok) {
                window.location.href = '/room/' + encodeURIComponent(roomId);
                return;
            }
            const data = await response.json().catch(() => ({}));
            window.toast &&
                window.toast.error(data.message || 'Could not create room.');
        } catch (err) {
            window.toast && window.toast.error('Network error. Try again.');
        } finally {
            createBtn.disabled = false;
        }
    }

    form.addEventListener('submit', createRoom);
})();
