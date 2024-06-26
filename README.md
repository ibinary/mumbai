# Mumbai
Mumbai is a simple, open-source, no-log, no-registration, one-to-one video conferencing system. You can download the source code for Mumbai and load it on your own server, run locally or experiment at the public use share on Sealed - https://mumbai.sealed.ch. The goal of Mumbai is for anyone who currently uses other web video-conferencing tools to self-host (your URL) to have full control of your risk profile and abstraction from other free or fee services who are known to use transcripts of calls for other purposes.

Mumbai employs the use of WebRTC and hard-coded limit to two (one-to-one) participant calling on demand to any device that supports current HTML standards (which include WebRTC). Mumbai is open-source and offers no accountability or liability for your use of this code or service. Mumbai was designed, funded and shared as open-source for legal use only.

Mumbai's code contains a hard-code lock to only two participants per call, with no "extras", plug-ins, data capture, log files or user identification. It was designed for one-on-one voice/video conversations without concern of silent third parties evesdropping or capturing the content for these conversations. Either party may initiate, invite, and terminate the calls for all parties on demand without constraint to tracking.
# Process:
Sealed invokes a process where media can be measured, cropped, shared, much like "edges" on paintings used for anti-forgery and insurance process. Standard hash-codes are generated to text and .json files to be secured personally, or on a service like IPFS or blockchain or redis or any preferred secured store.

1. Using any modern browser (Chrome, Edge, Safari, Firefox (WebRTC Supported)) navigate to a Mumbai site or use via Sealed at - https://mumbai.sealed.ch.
2. Create a room with a name of your choice.
3. Enter your name for the call.
4. Share the URL via any medium to the second party or press "Share" for a QR Code.
5. When both parties have entered the virtual room, call comenses with the ability to toggle use of both Microphone (Mute) or Camera (Mute).
6. If either party terminates the call (Exit) the call terminates for both parties and memory is flushed with the site reloaded for the next call.

![sealed-process](https://github.com/ibinary/mumbai/assets/)

# Post Process:
1. At the end of the call, click-or-press "Exit" and the call will be terminated for both parties.
2. As part of the call termination, memory is wiped and Mumbai returns to the initial landing page.
# Post Release 3.x:
1. Added support for FIDO2 initiated calls.
2. Added support for low-cost, dedicated, hardend platform (hardware) to abstract from personal devices.
# Dependencies:
Linux: Install the code on your web server.
Windows: Install the code on your web server.
macOS: Install the code on your web server.
# History:
The idea for Mumbai was the secondary effect of work on it's elder Bombay, whose design was prompted by the reduction of privacy and growing use of transcript (AI) scraping by most conferencing tools. A chance conversation with my friends Lucian and Jake led directly to the funding and sharing of these respective tools. I am concerned about the reduction of trust with digital tools, and the generic lack of commitment to open-source for verification. As AI use in all things digital, especially social media and WebRTC like conferencing systems, a need has grown to have a simple, secure, open-source method to protect individuals and the institutions they work with to confirm the comitment to privacy and not be used as a feed to their AI corpus. 
# Contact:
We hope others can leverage Mumbai for their own, personal or institutional needs. If you have any suggestions, enhancements, updates, forks, all are warmly welcomed at sealed-ch@pm.me
#
Jake Kitchen - jakekitchen@proton.me / Ken Nickerson - kenn@ibinary.com
Mumbai was privately funded by iBinary LLC.
