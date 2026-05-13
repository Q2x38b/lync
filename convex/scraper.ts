// Server-side version of the Scrapper.ts logic, wrapped as a Convex action
// so the React app can trigger it. Same Unsplash /napi/search/photos endpoint
// the standalone CLI scraper uses -- the difference is this runs in Convex's
// server runtime, which avoids the browser CORS block.

import { action } from "./_generated/server";
import { v } from "convex/values";

type UnsplashPhoto = {
  urls?: { regular?: string; small?: string; full?: string };
};

type UnsplashSearchResponse = {
  results?: UnsplashPhoto[];
};

// Fallback URLs used if Unsplash blocks the server-side request. These are
// stable Unsplash CDN links so the picker stays usable for the demo even if
// the /napi/search call fails (Unsplash sometimes 403s serverless IPs).
const FALLBACK_URLS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080",
  "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1080",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1080",
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1080",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1080",
];

export const fetchBackgrounds = action({
  args: {
    term: v.string(),
  },
  handler: async (_ctx, { term }) => {
    const query = (term || "nature").trim();
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20`;

    try {
      const res = await fetch(url, {
        headers: {
          // Match a real browser as closely as possible. Unsplash will 403 a
          // bare "node-fetch" or empty User-Agent on its internal endpoint.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://unsplash.com/",
        },
      });

      if (!res.ok) {
        console.warn(
          `[scraper] Unsplash returned ${res.status} for "${query}", using fallback`
        );
        return { term: query, urls: FALLBACK_URLS, source: "fallback" as const };
      }

      const data = (await res.json()) as UnsplashSearchResponse;
      const urls = (data.results ?? [])
        .map((p) => p.urls?.regular)
        .filter((u): u is string => typeof u === "string");

      if (urls.length === 0) {
        console.warn(
          `[scraper] No results for "${query}" from Unsplash, using fallback`
        );
        return { term: query, urls: FALLBACK_URLS, source: "fallback" as const };
      }

      return { term: query, urls, source: "unsplash" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] fetch failed for "${query}": ${message}`);
      return { term: query, urls: FALLBACK_URLS, source: "fallback" as const };
    }
  },
});
