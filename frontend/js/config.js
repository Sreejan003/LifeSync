/**
 * LifeSync Frontend Runtime Configuration (js/config.js)
 * Automatically routes API calls to the Render backend when deployed,
 * or localhost:5000 during local development.
 */
(function() {
    'use strict';

    const isLocal = typeof window !== 'undefined' && window.location &&
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname === '0.0.0.0');

    window.__LIFESYNC_API_URL__ = isLocal 
        ? 'http://localhost:5000/api'
        : 'https://lifesync-vpg3.onrender.com/api';
})();
