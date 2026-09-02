/**
 * playback.js
 * 
 * Detects the main HTML5 <video> element on the current page 
 * and observes local playback actions.
 */

// 1. Create a variable to store the currently detected video element.
let currentVideo = null;

// Track if we've already attached listeners to the current video
let listenersAttached = false;

/**
 * 2. Gets the video element from the DOM.
 * Returns the stored video if it's still connected.
 * Otherwise, searches for a new one.
 */
function getVideoElement() {
    // Return stored video if it is still connected to the DOM
    if (currentVideo && currentVideo.isConnected) {
        return currentVideo;
    }

    // Search for a video element
    const video = document.querySelector("video");
    
    if (video) {
        // If a new video is found, store it and reset the listeners flag
        currentVideo = video;
        listenersAttached = false;
        return currentVideo;
    }

    // Return null if no video exists
    currentVideo = null;
    listenersAttached = false;
    return null;
}

/**
 * 3. Initializes playback event listeners on the video element.
 */
function initializePlaybackListeners() {
    const video = getVideoElement();

    if (!video) {
        console.log("Symbiance: No video element found yet.");
        return;
    }

    // 5. Prevent attaching duplicate listeners if called multiple times
    if (listenersAttached) {
        return;
    }

    // 4. Attach listeners that log the event and the video's currentTime, and send playback messages.
    video.addEventListener("play", () => {
        console.log("Symbiance: Local play detected at:", video.currentTime);
        window.parent.postMessage({
            source: "symbiance",
            type: "playback",
            action: "play",
            currentTime: video.currentTime
        }, "*");
    });

    video.addEventListener("pause", () => {
        console.log("Symbiance: Local pause detected at:", video.currentTime);
        window.parent.postMessage({
            source: "symbiance",
            type: "playback",
            action: "pause",
            currentTime: video.currentTime
        }, "*");
    });

    video.addEventListener("seeking", () => {
        console.log("Symbiance: Local seek detected at:", video.currentTime);
        window.parent.postMessage({
            source: "symbiance",
            type: "playback",
            action: "seek",
            currentTime: video.currentTime
        }, "*");
    });

    listenersAttached = true;
    console.log("Symbiance: Playback listeners successfully attached to video.");
}

/**
 * 7. Add a MutationObserver that watches the document and calls 
 * initializePlaybackListeners() when new elements are added.
 */
const observer = new MutationObserver((mutations) => {
    // If we already have a connected video with listeners, we can skip checking
    if (currentVideo && currentVideo.isConnected && listenersAttached) {
        return;
    }

    // Check if any new nodes were added
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            initializePlaybackListeners();
            break; // Only need to call it once per mutation batch
        }
    }
});

// Start observing the entire document for dynamically added elements
observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

// Try to initialize immediately in case the video is already in the DOM
initializePlaybackListeners();

// 8. Listen for remote playback commands forwarded by the top window
window.addEventListener("message", (event) => {
    
    // SECURITY: Verify the message came from the parent or top window
    try {
        if (event.source !== window.parent && event.source !== window.top) {
            return;
        }
    } catch (e) {
        return;
    }

    const data = event.data;
    
    // Validate payload shape
    if (!data || typeof data !== "object") return;
    if (data.source !== "symbiance" || data.type !== "playback") return;

    const action = data.action;
    const currentTime = data.currentTime;

    // Validate action type and currentTime
    if (
        (action === "play" || action === "pause" || action === "seek") && 
        typeof currentTime === "number"
    ) {
        console.log("Symbiance: Video iframe received remote playback command:", data);
        
        // Remote playback execution will be implemented here later
    }
});
