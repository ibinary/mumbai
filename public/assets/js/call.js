/* global QRCode, Peer, cameraGrid, toggleAudio, toggleVideo */
(function () {
    'use strict';

    class User {
        constructor({ peerId, name, avatar }) {
            this.peerId = peerId;
            this.name = name;
            this.avatar = avatar;
        }
    }

    const room = new Map();
    let name;

    // ---------- WebSocket manager (unchanged behavior, cleaner internals) ---
    class WebSocketManager {
        constructor() {
            this.ws = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.reconnectDelay = 1000;
            this.heartbeatInterval = null;
            this.heartbeatTimer = 30000;
            this.messageQueue = [];
            this.isConnecting = false;
            this.connectionParams = null;
            this.onMessageHandlers = [];
            this.onOpenHandlers = [];
            this.onCloseHandlers = [];
            this.connectionStatus = 'disconnected';
        }

        connect(url, params = {}) {
            if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
            this.connectionParams = { url, params };
            this.isConnecting = true;
            this.connectionStatus = 'connecting';
            this.updateConnectionStatus('Connecting...');
            try {
                this.ws = new WebSocket(url);
                this.setupEventHandlers();
            } catch (err) {
                this.handleConnectionError();
            }
        }

        setupEventHandlers() {
            this.ws.onopen = () => {
                this.isConnecting = false;
                this.connectionStatus = 'connected';
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.updateConnectionStatus('Connected');
                this.startHeartbeat();
                this.processMessageQueue();
                this.onOpenHandlers.forEach((h) => h());
            };
            this.ws.onmessage = (event) => {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (data.type === 'pong') return;
                this.onMessageHandlers.forEach((h) => h(event));
            };
            this.ws.onclose = (event) => {
                this.isConnecting = false;
                this.connectionStatus = 'disconnected';
                this.stopHeartbeat();
                this.cleanupCameraGrid();
                this.onCloseHandlers.forEach((h) => h(event));

                // Surface server-side rejections as user-visible toasts.
                if (event.code === 4401) {
                    window.toast &&
                        window.toast.error(
                            'This room requires an active session. Create or reopen the room to continue.'
                        );
                    setTimeout(() => (window.location.href = '/'), 1500);
                    return;
                }
                if (event.code === 4403) {
                    window.toast && window.toast.error('The room is full.');
                    setTimeout(() => (window.location.href = '/'), 1500);
                    return;
                }
                if (event.code === 4404) {
                    window.toast && window.toast.error('Room no longer exists.');
                    setTimeout(() => (window.location.href = '/'), 1500);
                    return;
                }
                if (event.code === 4400) {
                    window.toast && window.toast.error('Bad request.');
                    return;
                }

                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.updateConnectionStatus('Disconnected - refresh to retry');
                }
            };
            this.ws.onerror = () => this.handleConnectionError();
        }

        cleanupCameraGrid() {
            const dish = document.querySelector('.Dish');
            if (!dish) return;
            const myId = 'my-camera';
            const my = document.getElementById(myId);
            const myStream = my && my.querySelector('video') && my.querySelector('video').srcObject;
            dish.innerHTML = '';
            if (my && myStream) {
                cameraGrid.addCamera(myId, 'You', true);
                cameraGrid.stream(myId, myStream);
            }
            room.clear();
            if (my) room.set('my-camera', new User({ peerId: 'my-camera', name: 'You' }));
        }

        handleConnectionError() {
            this.isConnecting = false;
            this.connectionStatus = 'disconnected';
            this.stopHeartbeat();
            if (this.reconnectAttempts < this.maxReconnectAttempts) this.attemptReconnect();
        }

        attemptReconnect() {
            if (this.isConnecting || !this.connectionParams) return;
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
            this.updateConnectionStatus(`Reconnecting ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            setTimeout(() => {
                if (this.connectionParams) this.connect(this.connectionParams.url, this.connectionParams.params);
            }, delay);
        }

        startHeartbeat() {
            this.stopHeartbeat();
            this.heartbeatInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'keep-alive', message: 'ping' }));
                }
            }, this.heartbeatTimer);
        }

        stopHeartbeat() {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        }

        send(message) {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(payload);
            } else {
                this.messageQueue.push(payload);
                if (this.connectionStatus === 'disconnected' && this.connectionParams) {
                    this.attemptReconnect();
                }
            }
        }

        processMessageQueue() {
            while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(this.messageQueue.shift());
            }
        }

        updateConnectionStatus(status) {
            let el = document.getElementById('connection-status');
            if (!el) {
                el = document.createElement('div');
                el.id = 'connection-status';
                el.className = 'connection-status ' + this.connectionStatus;
                document.body.appendChild(el);
            }
            el.textContent = status;
            el.className = 'connection-status ' + this.connectionStatus;
        }

        onMessage(h) {
            this.onMessageHandlers.push(h);
        }
        onOpen(h) {
            this.onOpenHandlers.push(h);
        }
        onClose(h) {
            this.onCloseHandlers.push(h);
        }

        close() {
            this.stopHeartbeat();
            if (this.ws) this.ws.close(1000, 'User closed connection');
            this.connectionParams = null;
            this.messageQueue = [];
        }

        isConnected() {
            return this.ws && this.ws.readyState === WebSocket.OPEN;
        }
    }

    const wsManager = new WebSocketManager();

    // ---------- Peer / media plumbing --------------------------------------

    const handleCall = (peer, stream) => {
        return ({ peerId: guestPeerId, name: guestName, openCamera, openMicrophone }) => {
            const call = peer.call(guestPeerId, stream, { metadata: name });
            let started = false;
            call.on('stream', (s) => {
                if (!started) {
                    started = true;
                    room.set(guestPeerId, new User({ peerId: guestPeerId, name: guestName }));
                    cameraGrid.addCamera('camera-' + guestPeerId, guestName);
                    if (!openCamera) cameraGrid.toggleCameraIcon('camera-' + guestPeerId, false);
                    if (!openMicrophone) cameraGrid.toggleMicrophoneIcon('camera-' + guestPeerId, false);
                }
                cameraGrid.stream('camera-' + guestPeerId, s);
            });
        };
    };

    const handleAnswer = (stream) => {
        return (call) => {
            const guestPeerId = call.peer;
            const guestName = call.metadata;
            call.answer(stream);
            let started = false;
            call.on('stream', (s) => {
                if (!started) {
                    started = true;
                    room.set(guestPeerId, new User({ peerId: guestPeerId, name: guestName }));
                    cameraGrid.addCamera('camera-' + guestPeerId, guestName);
                }
                cameraGrid.stream('camera-' + guestPeerId, s);
            });
        };
    };

    const handleCloseCall = (peerId) => {
        cameraGrid.removeCamera('camera-' + peerId);
        room.delete(peerId);
    };

    const onSuccess = (stream) => {
        // PeerJS is mounted on the same origin/port as the page, so reuse
        // location so it works behind any reverse proxy / TLS setup.
        const isHttps = location.protocol === 'https:';
        const peer = new Peer({
            host: location.hostname,
            port: location.port ? Number(location.port) : isHttps ? 443 : 80,
            path: window.__PEER_PATH__ || '/mumbai',
            secure: isHttps,
        });

        peer.on('open', function (peerId) {
            const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
            const qs = new URLSearchParams({ roomId: window.roomId, peerId });
            wsManager.onOpen(() => {
                wsManager.send({ type: 'join_profile', message: name });
            });
            wsManager.connect(`${scheme}://${location.host}/ws?${qs.toString()}`);
            room.set(peerId, new User({ peerId, name }));
            handleCallControl(stream);

            wsManager.onMessage((event) => {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }
                const { type, message } = data;
                switch (type) {
                    case 'join_room':
                        (message || []).forEach(handleCall(peer, stream));
                        break;
                    case 'disconnect':
                        handleCloseCall(message);
                        break;
                    case 'microphone':
                        cameraGrid.toggleMicrophoneIcon('camera-' + message.peerId, message.value);
                        break;
                    case 'camera':
                        cameraGrid.toggleCameraIcon('camera-' + message.peerId, message.value);
                        break;
                    case 'room_full':
                        window.toast && window.toast.error('Room is full.');
                        setTimeout(() => (window.location.href = '/'), 1500);
                        break;
                    case 'force_close':
                        window.toast && window.toast.info('The call has ended.');
                        wsManager.close();
                        setTimeout(() => (window.location.href = '/'), 1200);
                        break;
                    default:
                        break;
                }
            });

            peer.on('call', handleAnswer(stream));
        });
    };

    const handleCallControl = (stream) => {
        document.querySelectorAll('.toggle-audio').forEach((el) => {
            el.onclick = () => toggleAudio(stream, (v) => wsManager.send({ type: 'microphone', message: v }));
        });
        document.querySelectorAll('.toggle-video').forEach((el) => {
            el.onclick = () => toggleVideo(stream, (v) => wsManager.send({ type: 'camera', message: v }));
        });
        const leave = document.querySelector('.leave-room');
        if (leave) {
            leave.onclick = async () => {
                try {
                    const response = await fetch(
                        `/room/delete/${encodeURIComponent(window.roomId)}`,
                        { method: 'DELETE', credentials: 'same-origin' }
                    );
                    if (!response.ok) {
                        window.toast && window.toast.error('Could not end the call.');
                    }
                } catch {
                    window.toast && window.toast.error('Network error ending call.');
                }
            };
        }
    };

    const displayDummyCameraIcon = (id, n) => cameraGrid.addCamera(id, n, false);

    const start = () => {
        const constraints = { audio: true, video: { facingMode: 'user' } };
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                cameraGrid.addCamera('my-camera', 'You', true);
                cameraGrid.stream('my-camera', stream);
                onSuccess(stream);
            })
            .catch(() => {
                displayDummyCameraIcon('my-camera', 'You');
                navigator.mediaDevices
                    .getUserMedia({ audio: true, video: false })
                    .then(onSuccess)
                    .catch(() => onSuccess(null));
            });
    };

    // ---------- Join form --------------------------------------------------

    const joinForm = document.getElementById('join-form');
    if (joinForm) {
        joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const v = document.getElementById('name').value.trim();
            if (!v) return;
            name = v.slice(0, 40);
            document.querySelector('.join').style.display = 'none';
            document.querySelector('.call').style.display = 'block';
            start();
            updateAddressBarShareUrl();
        });
    }

    // ---------- Share / QR modal ------------------------------------------

    const shareBtn = document.getElementById('share-room');
    if (shareBtn) {
        shareBtn.addEventListener('click', openShareModal);
    }

    async function mintShareUrl(expiresInMs) {
        // Ask the server for a join token. The shared URL embeds this token,
        // never the room secret itself.
        const res = await fetch(
            `/room/${encodeURIComponent(window.roomId)}/share-token`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresInMs }),
            }
        );
        if (!res.ok) throw new Error('token_request_failed');
        const { token, expiresInMs: serverExpiresInMs } = await res.json();
        if (!token) throw new Error('no_token');
        const base = `${location.origin}/room/${encodeURIComponent(window.roomId)}`;
        return {
            url: `${base}?t=${encodeURIComponent(token)}`,
            expiresInMs: serverExpiresInMs == null ? null : serverExpiresInMs,
        };
    }

    function setAddressBarShareUrl(url) {
        if (!url || !window.history || !window.history.replaceState) return;
        window.history.replaceState(window.history.state, '', url);
    }

    async function updateAddressBarShareUrl(expiresInMs = null) {
        try {
            const result = await mintShareUrl(expiresInMs);
            setAddressBarShareUrl(result.url);
            return result;
        } catch {
            return null;
        }
    }

    function getRequestedExpiry(expiryInput) {
        const raw = expiryInput.value;
        if (!raw) return null;

        const ttlMs = Number(raw);
        if (!Number.isFinite(ttlMs) || ttlMs < 60 * 1000 || ttlMs > 7 * 24 * 60 * 60 * 1000) {
            throw new Error('invalid_expiry');
        }

        return ttlMs;
    }

    function formatExpiryHint(expiresInMs) {
        if (expiresInMs === null) {
            return 'This link does not expire while the room exists.';
        }

        const minutes = Math.max(1, Math.round(expiresInMs / 60000));
        if (minutes < 60) return `This link is valid for ${minutes} minute${minutes === 1 ? '' : 's'}.`;

        const hours = Math.round(minutes / 60);
        if (hours < 24) return `This link is valid for ${hours} hour${hours === 1 ? '' : 's'}.`;

        const days = Math.round(hours / 24);
        return `This link is valid for ${days} day${days === 1 ? '' : 's'}.`;
    }

    async function openShareModal() {
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const card = document.createElement('div');
        card.className = 'share-modal-card';

        const title = document.createElement('h3');
        title.textContent = 'Share room';
        card.appendChild(title);

        const hint = document.createElement('p');
        hint.className = 'share-modal-hint';
        hint.textContent = 'No expiry is selected by default. Change it anytime to create a fresh invite.';
        card.appendChild(hint);

        const expiryForm = document.createElement('form');
        expiryForm.className = 'share-modal-expiry';

        const expiryLabel = document.createElement('label');
        expiryLabel.setAttribute('for', 'share-expiry');
        expiryLabel.textContent = 'Invite expires';

        const expirySelect = document.createElement('select');
        expirySelect.id = 'share-expiry';
        [
            ['No expiry', ''],
            ['30 minutes', String(30 * 60 * 1000)],
            ['1 hour', String(60 * 60 * 1000)],
            ['4 hours', String(4 * 60 * 60 * 1000)],
            ['1 day', String(24 * 60 * 60 * 1000)],
            ['7 days', String(7 * 24 * 60 * 60 * 1000)],
        ].forEach(([label, value]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            expirySelect.appendChild(option);
        });

        const expiryHelp = document.createElement('span');
        expiryHelp.textContent = 'Changing this refreshes the QR code and link.';

        const updateBtn = document.createElement('button');
        updateBtn.className = 'btn';
        updateBtn.type = 'submit';
        updateBtn.textContent = 'Refresh';

        expiryForm.appendChild(expiryLabel);
        expiryForm.appendChild(expirySelect);
        expiryForm.appendChild(updateBtn);
        expiryForm.appendChild(expiryHelp);
        card.appendChild(expiryForm);

        const qr = document.createElement('div');
        qr.className = 'share-modal-qr';
        qr.textContent = 'Generating QR code...';
        card.appendChild(qr);

        const actions = document.createElement('div');
        actions.className = 'share-modal-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn';
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy URL';
        copyBtn.disabled = true;
        copyBtn.onclick = async () => {
            if (!shareUrl) return;
            try {
                await navigator.clipboard.writeText(shareUrl);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => (copyBtn.textContent = 'Copy URL'), 1800);
            } catch {
                window.toast && window.toast.info(shareUrl);
            }
        };
        actions.appendChild(copyBtn);

        let shareUrl = '';
        let nativeShareBtn = null;

        const renderShareLink = async () => {
            let expiresInMs;
            try {
                expiresInMs = getRequestedExpiry(expirySelect);
            } catch {
                window.toast &&
                    window.toast.error('Choose one of the expiry options.');
                return;
            }

            updateBtn.disabled = true;
            copyBtn.disabled = true;
            if (nativeShareBtn) nativeShareBtn.disabled = true;
            qr.textContent = 'Creating share link...';

            try {
                const result = await mintShareUrl(expiresInMs);
                shareUrl = result.url;
                setAddressBarShareUrl(shareUrl);
                hint.textContent = formatExpiryHint(result.expiresInMs);
                qr.innerHTML = '';
                // eslint-disable-next-line no-new
                new QRCode(qr, {
                    text: shareUrl,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H,
                });
                copyBtn.disabled = false;
                if (nativeShareBtn) nativeShareBtn.disabled = false;
                updateBtn.textContent = 'Refresh';
            } catch {
                shareUrl = '';
                qr.textContent = 'Could not create a share link.';
                if (nativeShareBtn) nativeShareBtn.disabled = true;
                window.toast &&
                    window.toast.error(
                        'Could not create a share link. Only the room creator can share.'
                    );
            } finally {
                updateBtn.disabled = false;
            }
        };

        expiryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            renderShareLink();
        });
        expirySelect.addEventListener('change', renderShareLink);

        if (navigator.share) {
            const shareButton = document.createElement('button');
            shareButton.className = 'btn';
            shareButton.type = 'button';
            shareButton.textContent = 'Share';
            shareButton.disabled = true;
            nativeShareBtn = shareButton;
            shareButton.onclick = () => {
                if (!shareUrl) return;
                const canvas = qr.querySelector('canvas');
                if (!canvas) return;
                canvas.toBlob((blob) => {
                    const file = new File([blob], 'mumbai-room-qr.png', { type: 'image/png' });
                    navigator
                        .share({
                            files: [file],
                            title: 'Join my Mumbai call',
                            text: 'Scan this QR code to join my video call.',
                            url: shareUrl,
                        })
                        .catch(() => {
                            navigator.clipboard
                                .writeText(shareUrl)
                                .then(() => window.toast && window.toast.success('URL copied.'))
                                .catch(() => window.toast && window.toast.info(shareUrl));
                        });
                }, 'image/png');
            };
            actions.appendChild(shareButton);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn--danger';
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => modal.remove();
        actions.appendChild(closeBtn);

        card.appendChild(actions);
        modal.appendChild(card);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        document.body.appendChild(modal);
        renderShareLink();
    }

})();
