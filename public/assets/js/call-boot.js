// Bootstrap globals consumed by call.js. Kept out of inline <script> so CSP
// can forbid 'unsafe-inline' and still function.
(function () {
    'use strict';

    const body = document.body;
    // Safe because we only read data- attributes already serialized by EJS's
    // auto-escaping. roomId is further validated server-side to [A-Za-z0-9_-].
    window.roomId = body.getAttribute('data-room-id') || '';
    window.__PEER_PATH__ = body.getAttribute('data-peer-path') || '/mumbai';
})();
