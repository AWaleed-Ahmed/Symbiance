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

    // Fallback: URL-based episode extraction if not found in JSON-LD
    if (!identity.episode && identity.url) {
        // Matches common episode URL patterns like: /ep-7, /episode-7, /episode/7, /ep/7
        const episodeMatch = identity.url.match(/\/(?:ep|episode)[-\/](\d+)/i);
        if (episodeMatch && episodeMatch[1]) {
            identity.episode = episodeMatch[1];
        }
    }

    return identity;
}

/**
 * Logs the best available information about the current page content.
 */
function logContentIdentity() {
    console.log("Symbiance: Content identity", getContentIdentity());
}

// Log content identity when the script initializes
logContentIdentity();

