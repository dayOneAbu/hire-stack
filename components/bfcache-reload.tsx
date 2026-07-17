"use client";

import { useEffect } from "react";

// ponytail: navigating home -> #hash-anchor -> a full route (e.g. /sign-in)
// -> back pops a popstate that changes the pathname, but the App Router's
// client cache sometimes skips the RSC fetch and leaves the previous page's
// DOM on screen while only the URL bar updates to "/#pricing". A bare hash
// change (same document, both old/new URL share a pathname) should stay a
// fast client-side scroll; anything else on popstate gets a hard reload so
// the DOM can never disagree with the URL.
export function BfcacheReload() {
  useEffect(() => {
    let lastPathname = window.location.pathname;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = function (...args) {
      originalPushState(...args);
      lastPathname = window.location.pathname;
    };
    window.history.replaceState = function (...args) {
      originalReplaceState(...args);
      lastPathname = window.location.pathname;
    };

    function resyncIfStale() {
      if (window.location.pathname !== lastPathname) {
        window.location.reload();
      }
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    window.addEventListener("popstate", resyncIfStale);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("popstate", resyncIfStale);
      window.removeEventListener("pageshow", handlePageShow);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
