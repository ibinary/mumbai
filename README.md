# Mumbai
Mumbai is a simple, open-source, zero-footprint, no-log, no-registration, no client downloads, one-to-one video conferencing system for two people to communicate in private. You can download the source code for Mumbai and load it on your own server, run locally or experiment with the public use share via Sealed - https://mumbai.sealed.ch. The goal of Mumbai is for anyone who currently uses video-conferencing tools to self-host (your URL) for full control of your risk profile and abstraction from other free or fee services who are known to use transcripts, identification, logs and other captured data from your calls for other purposes.

Mumbai employs the use of WebRTC for video conferencing on demand to any device that supports current HTML standards. Mumbai's code contains a hard-coded lock to only two participants per call, with no "extras", plug-ins, data capture, log files or user identification. It was designed for simplified, personal conversations without concern of third parties evesdropping or capturing the content. Either party may initiate, invite, and terminate the calls for all parties on demand without constraint.

Mumbai is one-to-one, peer-to-peer and can opperate on VPNs, Tor or i2P. Mumbai is open-source and offers no accountability or liability for your use of this code or service. Mumbai was designed, funded and shared as open-source for legal use only.
# Process:
Mumbai invokes a WebRTC based initial process to connect two participants to a shared virtual room for video conferencing. Mumbai is hard-coded to limit these rooms to only two participants, each with anonymous control to create, share, participate and terminate calls.

1. Using any modern browser (Chrome, Edge, Safari, Firefox...) with WebRTC support, navigate to a Mumbai site or use via Sealed at - https://mumbai.sealed.ch.
2. Create a room with a name of your choice.
3. Enter your name for the call.
4. Share the URL via any medium to the second party or press "Share" for a QR Code.
5. When both parties have entered the virtual room, call comenses with the ability to toggle use of both Microphone (Mute) or Camera (Mute).
6. On most browsers and OS, press F11 for full screen and you can then focus on your meeting.
7. If either party terminates the call (Exit) the call terminates for both parties and memory is flushed with the site reloaded for the next call.

![project-mumbai-2](https://github.com/ibinary/mumbai/assets/86942/c917374c-65c2-4911-a675-060e05043259)

# Post Process:
1. At the end of the call, click-or-press "Exit" and the call will be terminated for both parties.
2. As part of the call termination, memory is wiped and Mumbai returns to the initial landing page.
# Post Release 2.x:
1. Added support for FIDO2 initiated calls.
2. Added support for low-cost, dedicated, hardend platform (hardware) to abstract from personal devices.
# Dependencies:
Linux: Install the code on your web server.
Windows: Install the code on your web server.
macOS: Install the code on your web server.
# History:
The idea for Mumbai was the secondary effect of work on it's elder full-feature "Bombay", whose design was prompted by the reduction of privacy and growing use of transcript (AI) scraping, user and technical identification by most commercial conferencing tools. A chance conversation with my friends Lucian and Jake led directly to the funding and sharing of these two respective tools. I am concerned about the reduction of trust with digital tools, and the generic lack of commitment to open-source for verification. As AI use in all things digital, especially social media and WebRTC like conferencing systems, a need has grown to have a simple, secure, open-source, clientless method to protect individuals and the institutions to confirm a comitment to privacy. 
# Contact:
We hope others can leverage Mumbai for their own, personal or institutional needs. If you have any suggestions, enhancements, updates, forks, all are warmly welcomed at sealed-ch@pm.me
#
Jake Kitchen - jakekitchen@proton.me / Ken Nickerson - kenn@ibinary.com
Mumbai was privately funded by iBinary LLC.
