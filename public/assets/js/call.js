class User {
    /**
     * Create a user.
     * @param {User} user
     * @param {string} user.peerId
     * @param {string} user.name
     * @param {string} user.avatar
     */
    constructor({ peerId, name, avatar }) {
        this.peerId = peerId;
        this.name = name;
        this.avatar = avatar;
    }
}

/**
 * Description
 * @type {Map<string, User>}
 */
const room = new Map();

/**
 * Description
 * @type {string}
 */
let name;


let messageSound = new Audio('/assets/audio/message.mp3');

navigator.getUserMedia =
    navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

/**
 * @param {Object} peer
 * @param {Object} stream
 * @return {function(user: User): void}
 */
const handleCall = (peer, stream) => {
    return ({ peerId: guestPeerId, name: guestName, openCamera, openMicrophone }) => {
        var call = peer.call(guestPeerId, stream, { metadata: name });
        let isStartedCamera = false;
        call.on('stream', function (stream) {
            if (!isStartedCamera) {
                isStartedCamera = true;
                room.set(guestPeerId, new User({ peerId: guestPeerId, name: guestName }));
                cameraGrid.addCamera('camera-' + guestPeerId, guestName);
                if (!openCamera) cameraGrid.toggleCameraIcon('camera-' + guestPeerId, false);
                if (!openMicrophone)
                    cameraGrid.toggleMicrophoneIcon('camera-' + guestPeerId, false);
            }
            cameraGrid.stream('camera-' + guestPeerId, stream);
        });
    };
};

/**
 * @param {Object} stream
 * @return {function(call: Object): void} remove user's camera
 */
const handleAnswer = (stream) => {
    return (call) => {
        const guestPeerId = call.peer;
        const guestName = call.metadata;
        // answer the call, providing our mediaStream
        call.answer(stream);
        let isStartedCamera = false;
        call.on('stream', function (stream) {
            if (!isStartedCamera) {
                isStartedCamera = true;
                room.set(guestPeerId, new User({ peerId: guestPeerId, name: guestName }));
                cameraGrid.addCamera('camera-' + guestPeerId, guestName);
            }
            cameraGrid.stream('camera-' + guestPeerId, stream);
        });
    };
};

/**
 * @param {string} peerId
 * @return {function(): void} remove user's camera
 */
const handleCloseCall = (peerId) => {
    cameraGrid.removeCamera('camera-' + peerId);
    room.delete(peerId);
};

/**
 * @param {Object} stream
 */
const onSuccess = (stream) => {
    (async () => {
        try {
            // Initialize the Peer object with the server's IPv6 address
            const peer = new Peer({
                host: 'mumbai.sealed.ch',
                port: 9000,
                path: '/mumbai',
                secure: true // Set to true if your server uses HTTPS
            });

            peer.on('open', function (peerId) {
                const isHttps = location.protocol.includes('https');
                const ws = new WebSocket(
                    `${isHttps ? 'wss' : 'ws'}://${
                        location.host
                    }/ws?roomId=${roomId}&peerId=${peerId}&name=${name}`
                );
                room.set(peerId, new User({ peerId, name }));
                handleCallControl(stream, ws);
                ws.onmessage = ({ data }) => {
                    const { type, message } = JSON.parse(data);

                    switch (type) {
                        case 'join_room': {
                            message.forEach(handleCall(peer, stream));
                            break;
                        }
                        case 'disconnect': {
                            handleCloseCall(message);
                            break;
                        }
                        case 'microphone': {
                            const { peerId, value } = message;
                            cameraGrid.toggleMicrophoneIcon('camera-' + peerId, value);
                            break;
                        }
                        case 'camera': {
                            const { peerId, value } = message;
                            cameraGrid.toggleCameraIcon('camera-' + peerId, value);
                            break;
                        }
                        case 'room_full': {
                            alert("The room is full. You will be redirected to the homepage.");
                            window.location.href = '/';
                            break;
                        }
                        case 'force_close': {
                            alert("The room is now closed.");
                            // Close the WebSocket connection
                            if (ws) {
                                ws.close();
                            }
                            // Redirect to homepage or another appropriate action
                            window.location.href = '/';
                            break;
                        }
                        default: {
                        }
                    }
                };

                peer.on('call', handleAnswer(stream));
            });
        } catch (error) {
            console.error("Failed to get server IP:", error);
        }
    })();
};

/**
 * @param {Object} ws websocket
 * @return {Function(value: Boolean) => void}
 */
const sendMessageMicrophone = (ws) => {
    return (value) => {
        ws.send(JSON.stringify({ type: 'microphone', message: value }));
    };
};

/**
 * @param {Object} ws websocket
 * @return {Function(value: Boolean) => void}
 */
const sendMessageCamera = (ws) => {
    return (value) => {
        ws.send(JSON.stringify({ type: 'camera', message: value }));
    };
};

/**
 * @param {Object} stream
 * @param {Object} ws websocket
 */
const handleCallControl = (stream, ws) => {
    document
        .querySelectorAll('.toggle-audio')
        .forEach((el) => (el.onclick = () => toggleAudio(stream, sendMessageMicrophone(ws))));
    document
        .querySelectorAll('.toggle-video')
        .forEach((el) => (el.onclick = () => toggleVideo(stream, sendMessageCamera(ws))));
    document.querySelector('.leave-room').onclick = async () => {
        try {
            const response = await fetch(`/room/delete/${roomId}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error("Failed to delete the room.");
            }
            // The actual closing and redirection will be handled by the WebSocket message
        } catch (error) {
            console.error("Error deleting the room:", error);
            alert("An error occurred while trying to delete the room.");
        }
    };
};
// Function to start sending keep-alive messages
function startKeepAlive(ws) {
    const interval = 30000; // 30 seconds

    const keepAliveMsg = JSON.stringify({ type: 'keep-alive', message: 'ping' });
    const keepAlive = () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(keepAliveMsg);
        }
    };

    // Send a keep-alive message every interval
    const keepAliveInterval = setInterval(keepAlive, interval);

    // Clear the interval on WebSocket close or error
    ws.addEventListener('close', () => clearInterval(keepAliveInterval));
    ws.addEventListener('error', () => clearInterval(keepAliveInterval));
}

// Call this function after establishing the WebSocket connection

const start = () => {
const constraints = { audio: true, video: { facingMode: "user" } };

navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
        cameraGrid.addCamera('my-camera', 'You', true);
        cameraGrid.stream('my-camera', stream);
        onSuccess(stream);
    })
    .catch((err) => {
        console.error("Error accessing media devices:", err);
        displayDummyCameraIcon('my-camera', 'You');
        const audioOnlyConstraints = { audio: true, video: false };
        navigator.mediaDevices.getUserMedia(audioOnlyConstraints)
            .then((audioStream) => {
                onSuccess(audioStream);
            })
            .catch((audioErr) => {
                console.error("Error accessing audio device:", audioErr);
                onSuccess(null);
            });
    });
};

// Function to display the dummy camera icon
function displayDummyCameraIcon(cameraId, name) {
    cameraGrid.addCamera(cameraId, name, false);
}

document.querySelector('#create-room').onclick = async (e) => {
    name = document.querySelector('#name').value;
    if (!name) return;
    e.preventDefault();
    Cookies.set('name', name);
    document.querySelector('.join').style.display = 'none';
    document.querySelector('.call').style.display = 'block';
    start();
};


const getTime = () => {
    const d = new Date();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    return `${hours < 10 ? `0${hours}` : hours}:${minutes < 10 ? `0${minutes}` : minutes}`;
};



const isURL = (str) => {
    var urlRegex =
        '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
    var url = new RegExp(urlRegex, 'i');
    return str.length < 2083 && url.test(str);
};


/*
 Really ugly will fix this code eventually
*/
document.querySelector('#share-room').onclick = function() {
    const currentUrl = window.location.href;

    // Create container for QR code and controls
    const qrCodeContainer = document.createElement('div');
    qrCodeContainer.id = 'qr-code-container';
    qrCodeContainer.style.position = 'fixed';
    qrCodeContainer.style.top = '50%';
    qrCodeContainer.style.left = '50%';
    qrCodeContainer.style.transform = 'translate(-50%, -50%)';
    qrCodeContainer.style.padding = '20px';
    qrCodeContainer.style.background = 'white';
    qrCodeContainer.style.borderRadius = '8px';
    qrCodeContainer.style.textAlign = 'center';
    qrCodeContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    document.body.appendChild(qrCodeContainer);

    // Create QR code
    const qrCode = new QRCode(qrCodeContainer, {
        text: currentUrl,
        width: 256,
        height: 256
    });

    // Add CSS for buttons
    const style = document.createElement('style');
    style.innerHTML = `
        .qr-button {
            margin: 10px;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .qr-button:hover {
            background-color: #0056b3;
        }
    `;
    document.head.appendChild(style);

    // Wait for QR code to render, then add buttons
    setTimeout(() => {
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Exit';
        closeButton.className = 'qr-button';
        closeButton.onclick = function() {
            qrCodeContainer.remove();
        };
        qrCodeContainer.appendChild(closeButton);

        // Add share button
        const shareButton = document.createElement('button');
        shareButton.textContent = 'Share QR Code';
        shareButton.className = 'qr-button';
        shareButton.onclick = function() {
            const canvas = qrCodeContainer.querySelector('canvas');
            canvas.toBlob(blob => {
                if (navigator.share) {
                    navigator.share({
                        files: [new File([blob], 'qr-code.png', { type: 'image/png' })],
                        title: 'Join my call',
                        text: 'Scan this QR code to join my call!'
                    }).catch(console.error);
                } else {
                    alert('Sharing not supported. Copy the QR code instead.');
                }
            });
        };
        qrCodeContainer.appendChild(shareButton);
    }, 100);
};
