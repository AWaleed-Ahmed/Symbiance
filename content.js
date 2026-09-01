// A WeakSet to keep track of video elements we've already processed
// to ensure we don't attach duplicate event listeners to the same element.
const processedVideos = new WeakSet();

/**
 * Extracts content identity information from the URL and page metadata.
 * @returns {Object} An object containing provider, url, seriesId, title, and episode.
 */
function getContentIdentity() {
    const identity = {
        provider: window.location.hostname || null,
        url: window.location.href || null,
        seriesId: null,
        title: null,
        episode: null
    };

    // Attempt to extract structured metadata from JSON-LD blocks
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            
            // Data can be an array or a single object
            const items = Array.isArray(data) ? data : [data];
            
            for (const item of items) {
                if (!item || typeof item !== 'object') continue;
                
                const type = item['@type'];
                
                // Prefer TVSeries or related media object metadata
                if (type === 'TVSeries' || type === 'Movie' || type === 'VideoObject') {
                    if (item['@id'] && !identity.seriesId) identity.seriesId = item['@id'];
                    if (item.name && !identity.title) identity.title = item.name;
                }
                
                // Extract episode if clearly available
                if (type === 'TVEpisode' && item.episodeNumber) {
                    identity.episode = String(item.episodeNumber);
                }
            }
        } catch (error) {
            // Handle invalid JSON-LD safely by ignoring it
        }
    }

    return identity;
}

/**
 * Logs the best available information about the current page content.
 */
function logContentIdentity() {
    console.log("FestiveWatch: Content identity", getContentIdentity());
}

// Log content identity when the script initializes
logContentIdentity();

/**
 * Handles watch party events. 
 * Later, this function will serve as the boundary where events are sent 
 * to the synchronization backend via messages.
 * @param {Object} event - The watch event containing type and time.
 */
function handleWatchEvent(event) {
    console.log("Symbiance: Watch event", event);
}

/**
 * Attaches event listeners to a video element to monitor playback state.
 * @param {HTMLVideoElement} video - The video element to monitor.
 */
function attachVideoListeners(video) {
    // Prevent attaching listeners multiple times to the same video
    if (processedVideos.has(video)) {
        return;
    }

    // Mark the video as processed
    processedVideos.add(video);
    console.log("Symbiance: Found a video element.", video);

    // Monitor when the video starts playing
    video.addEventListener('play', () => {
        console.log(`Symbiance: Video started playing at ${video.currentTime}`);
        handleWatchEvent({
            type: "play",
            time: video.currentTime
        });
    });

    // Monitor when the video pauses
    video.addEventListener('pause', () => {
        console.log(`Symbiance: Video was paused at ${video.currentTime}`);
        handleWatchEvent({
            type: "pause",
            time: video.currentTime
        });
    });

    // Monitor when the user seeks through the video
    video.addEventListener('seeking', () => {
        console.log(`Symbiance: User is seeking. Current time: ${video.currentTime}`);
        handleWatchEvent({
            type: "seek",
            time: video.currentTime
        });
    });
}

// 1. Process all <video> elements that are already present in the DOM
const existingVideos = document.querySelectorAll('video');
existingVideos.forEach(attachVideoListeners);

// 2. Setup a MutationObserver to catch <video> elements added dynamically
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                // If the added node is a <video> element itself
                if (node.nodeName && node.nodeName.toLowerCase() === 'video') {
                    attachVideoListeners(node);
                }

                // If the added node contains <video> elements within it
                if (node.querySelectorAll) {
                    const nestedVideos = node.querySelectorAll('video');
                    nestedVideos.forEach(attachVideoListeners);
                }
            });
        }
    }
});

// Start observing the entire document for dynamically added nodes
observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});
