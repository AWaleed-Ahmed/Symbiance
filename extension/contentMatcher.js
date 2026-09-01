/**
 * contentMatcher.js
 *
 * Responsible for comparing two Symbiance content identity objects
 * and determining whether they represent compatible watch content.
 *
 * Matching philosophy:
 *
 *   STRONG
 *     Same series + same episode.
 *
 *   PARTIAL
 *     Same series/title, but episode information is missing.
 *
 *   UNCERTAIN
 *     Not enough information to confidently identify the content.
 *
 *   MISMATCH
 *     Known information proves that the content is different.
 *
 * Provider and URL are supporting information only.
 * They are NOT required to match because two users may legitimately
 * watch the same content through different providers or URLs.
 */

/**
 * Normalize a value for safe comparison.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normalize(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim().toLowerCase();

    return normalized || null;
}

/**
 * Compares two Symbiance content identity objects.
 *
 * @param {Object} localIdentity
 * @param {Object} remoteIdentity
 *
 * @returns {Object}
 *
 * Example:
 *
 * {
 *     match: true,
 *     confidence: "strong",
 *     reasons: [
 *         "Series ID matches",
 *         "Episode matches",
 *         "Provider differs (allowed)"
 *     ]
 * }
 */
function matchContentIdentity(localIdentity, remoteIdentity) {
    const result = {
        match: false,
        confidence: "uncertain",
        reasons: []
    };

    // ------------------------------------------------------------------------
    // 1. Validate input
    // ------------------------------------------------------------------------

    if (!localIdentity || !remoteIdentity) {
        result.confidence = "uncertain";
        result.reasons.push("Missing identity information");
        return result;
    }

    // ------------------------------------------------------------------------
    // 2. Normalize values
    // ------------------------------------------------------------------------

    const localProvider = normalize(localIdentity.provider);
    const remoteProvider = normalize(remoteIdentity.provider);

    const localSeriesId = normalize(localIdentity.seriesId);
    const remoteSeriesId = normalize(remoteIdentity.seriesId);

    const localTitle = normalize(localIdentity.title);
    const remoteTitle = normalize(remoteIdentity.title);

    const localEpisode = normalize(localIdentity.episode);
    const remoteEpisode = normalize(remoteIdentity.episode);

    const localUrl = normalize(localIdentity.url);
    const remoteUrl = normalize(remoteIdentity.url);

    // ------------------------------------------------------------------------
    // 3. Compare provider
    //
    // Provider mismatch is NOT a content mismatch.
    //
    // Example:
    //
    //   user A -> aniwaves.ru
    //   user B -> another-provider.com
    //
    // They can still be watching the same episode.
    // ------------------------------------------------------------------------

    if (localProvider && remoteProvider) {
        if (localProvider === remoteProvider) {
            result.reasons.push("Provider matches");
        } else {
            result.reasons.push("Provider differs (allowed)");
        }
    } else {
        result.reasons.push("Provider information incomplete");
    }

    // ------------------------------------------------------------------------
    // 4. Compare series identity
    //
    // Series ID is the strongest series-level identifier.
    // If it is unavailable, fall back to title.
    // ------------------------------------------------------------------------

    let seriesMatch = false;
    let seriesMismatch = false;

    if (localSeriesId && remoteSeriesId) {
        if (localSeriesId === remoteSeriesId) {
            seriesMatch = true;
            result.reasons.push("Series ID matches");
        } else {
            seriesMismatch = true;
            result.reasons.push("Series ID differs");
        }
    } else if (localTitle && remoteTitle) {

        if (localTitle === remoteTitle) {
            seriesMatch = true;
            result.reasons.push("Title matches");
        } else {
            seriesMismatch = true;
            result.reasons.push("Title differs");
        }
    } else {
        result.reasons.push("Series identity incomplete");
    }

    // ------------------------------------------------------------------------
    // 5. If we KNOW the series is different, stop immediately.
    // ------------------------------------------------------------------------

    if (seriesMismatch) {
        result.match = false;
        result.confidence = "mismatch";
        return result;
    }

    // ------------------------------------------------------------------------
    // 6. Compare episode
    // ------------------------------------------------------------------------

    let episodeMatch = false;
    let episodeMismatch = false;
    let episodeEvidence = false;

    if (localEpisode && remoteEpisode) {
        episodeEvidence = true;

        if (localEpisode === remoteEpisode) {
            episodeMatch = true;
            result.reasons.push("Episode matches");
        } else {
            episodeMismatch = true;
            result.reasons.push("Episode differs");
        }
    } else {
        result.reasons.push("Episode information incomplete");
    }

    // ------------------------------------------------------------------------
    // 7. Different episodes are ALWAYS a mismatch.
    // ------------------------------------------------------------------------

    if (episodeMismatch) {
        result.match = false;
        result.confidence = "mismatch";
        return result;
    }

    // ------------------------------------------------------------------------
    // 8. Compare URLs as supporting evidence.
    //
    // Query parameters and fragments are ignored.
    //
    // URL mismatch is NEVER enough by itself to reject content because
    // different providers may use completely different URLs.
    // ------------------------------------------------------------------------

    if (localUrl && remoteUrl) {
        try {
            const url1 = new URL(localUrl);
            const url2 = new URL(remoteUrl);

            const sameHost = url1.hostname === url2.hostname;
            const samePath = url1.pathname === url2.pathname;

            if (sameHost && samePath) {
                result.reasons.push(
                    "URL matches (ignoring query parameters and fragment)"
                );
            } else {
                result.reasons.push(
                    "URL differs (allowed when metadata matches)"
                );
            }
        } catch (error) {
            result.reasons.push("URL comparison unavailable");
        }
    } else {
        result.reasons.push("URL information incomplete");
    }

    // ------------------------------------------------------------------------
    // 9. Determine final confidence
    // ------------------------------------------------------------------------

    /*
     * STRONG MATCH
     *
     * We know:
     *
     *   same series
     *   +
     *   same episode
     *
     * This is safe for synchronization.
     */
    if (seriesMatch && episodeMatch) {
        result.match = true;
        result.confidence = "strong";
        return result;
    }

    /*
     * PARTIAL MATCH
     *
     * We know the series is the same, but cannot confirm the episode.
     *
     * This should NOT automatically begin playback synchronization.
     */
    if (seriesMatch && !episodeEvidence) {
        result.match = false;
        result.confidence = "partial";
        result.reasons.push(
            "Same series detected, but episode could not be confirmed"
        );
        return result;
    }

    /*
     * If we have a matching title/series but only one side has episode
     * information, we cannot safely synchronize.
     */
    if (seriesMatch && episodeEvidence && !episodeMatch) {
        result.match = false;
        result.confidence = "partial";
        result.reasons.push(
            "Series matches, but episode could not be confirmed on both sides"
        );
        return result;
    }

    /*
     * UNCERTAIN
     *
     * We don't have enough identity information to determine whether
     * the users are watching the same content.
     */
    result.match = false;
    result.confidence = "uncertain";
    result.reasons.push(
        "Insufficient content identity information"
    );

    return result;
}


// ============================================================================
// CommonJS export
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        matchContentIdentity
    };
}


// ============================================================================
// TESTS
// ============================================================================

if (typeof require !== "undefined" && require.main === module) {

    console.log("Running Content Matcher Tests...\n");

    const runTest = (
        name,
        local,
        remote,
        expectedMatch,
        expectedConfidence
    ) => {

        const result = matchContentIdentity(local, remote);

        const passed =
            result.match === expectedMatch &&
            result.confidence === expectedConfidence;

        console.log(
            `${passed ? "PASS" : "FAIL"}: ${name}`
        );

        console.log(
            `Expected: match=${expectedMatch}, confidence=${expectedConfidence}`
        );

        console.log(
            `Got:      match=${result.match}, confidence=${result.confidence}`
        );

        console.log(
            `Reasons:  ${JSON.stringify(result.reasons)}\n`
        );
    };


    // ------------------------------------------------------------------------
    // STRONG MATCHES
    // ------------------------------------------------------------------------

    runTest(
        "Same provider + same series + same episode",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        true,
        "strong"
    );


    runTest(
        "Different providers + same series + same episode",
        {
            provider: "aniwaves.ru",
            url: "https://aniwaves.ru/watch/show-123",
            seriesId: "S1",
            title: "Show",
            episode: "9"
        },
        {
            provider: "other-provider.com",
            url: "https://other-provider.com/player/abc",
            seriesId: "S1",
            title: "Show",
            episode: "9"
        },
        true,
        "strong"
    );


    runTest(
        "Different URLs + same metadata",
        {
            provider: "aniwaves.ru",
            url: "https://aniwaves.ru/watch/show-123",
            seriesId: "S1",
            title: "Show",
            episode: "9"
        },
        {
            provider: "other-provider.com",
            url: "https://other-provider.com/player/abc",
            seriesId: "S1",
            title: "Show",
            episode: "9"
        },
        true,
        "strong"
    );


    runTest(
        "Different URL query parameters",
        {
            provider: "test.com",
            url: "https://test.com/watch/1?t=10",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/1?autoplay=1",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        true,
        "strong"
    );


    // ------------------------------------------------------------------------
    // MISMATCHES
    // ------------------------------------------------------------------------

    runTest(
        "Different series IDs",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/2",
            seriesId: "S2",
            title: "Show",
            episode: "1"
        },
        false,
        "mismatch"
    );


    runTest(
        "Different episodes",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/2",
            seriesId: "S1",
            title: "Show",
            episode: "2"
        },
        false,
        "mismatch"
    );


    runTest(
        "Different titles",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: "Naruto",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/2",
            seriesId: null,
            title: "One Piece",
            episode: "1"
        },
        false,
        "mismatch"
    );


    runTest(
        "Different providers + different series",
        {
            provider: "aniwaves.ru",
            url: "https://aniwaves.ru/watch/naruto",
            seriesId: "NARUTO",
            title: "Naruto",
            episode: "9"
        },
        {
            provider: "other.com",
            url: "https://other.com/watch/one-piece",
            seriesId: "ONEPIECE",
            title: "One Piece",
            episode: "9"
        },
        false,
        "mismatch"
    );


    // ------------------------------------------------------------------------
    // PARTIAL
    // ------------------------------------------------------------------------

    runTest(
        "Same series + episode missing",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: null
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: "S1",
            title: "Show",
            episode: null
        },
        false,
        "partial"
    );


    runTest(
        "Same title + episode missing",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: "Show",
            episode: null
        },
        {
            provider: "other.com",
            url: "https://other.com/player/abc",
            seriesId: null,
            title: "Show",
            episode: null
        },
        false,
        "partial"
    );


    // ------------------------------------------------------------------------
    // UNCERTAIN
    // ------------------------------------------------------------------------

    runTest(
        "No useful identity information",
        {
            provider: null,
            url: null,
            seriesId: null,
            title: null,
            episode: null
        },
        {
            provider: null,
            url: null,
            seriesId: null,
            title: null,
            episode: null
        },
        false,
        "uncertain"
    );


    runTest(
        "Only URL available",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: null,
            episode: null
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: null,
            episode: null
        },
        false,
        "uncertain"
    );


    // ------------------------------------------------------------------------
    // CASE INSENSITIVITY
    // ------------------------------------------------------------------------

    runTest(
        "Title comparison is case insensitive",
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: "My Show",
            episode: "1"
        },
        {
            provider: "test.com",
            url: "https://test.com/watch/1",
            seriesId: null,
            title: "my show",
            episode: "1"
        },
        true,
        "strong"
    );


    // ------------------------------------------------------------------------
    // CROSS-PROVIDER EPISODE MISMATCH
    // ------------------------------------------------------------------------

    runTest(
        "Different providers + same series + different episode",
        {
            provider: "aniwaves.ru",
            url: "https://aniwaves.ru/watch/show-123",
            seriesId: "S1",
            title: "Show",
            episode: "9"
        },
        {
            provider: "other-provider.com",
            url: "https://other-provider.com/player/abc",
            seriesId: "S1",
            title: "Show",
            episode: "10"
        },
        false,
        "mismatch"
    );

    console.log("Content Matcher Tests Complete.");
}