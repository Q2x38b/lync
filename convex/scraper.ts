// Server-side version of the Scrapper.ts logic, wrapped as a Convex action
// so the React app can trigger it. Same Unsplash /napi/search/photos endpoint
// the standalone CLI scraper uses -- the difference is this runs in Convex's
// server runtime, which avoids the browser CORS block.

import { action } from "./_generated/server";
import { v } from "convex/values";

type UnsplashPhoto = {
  urls: { regular: string; small: string; full: string };
  alt_description: string | null;
};

type UnsplashSearchResponse = {
  total: number;
  results: UnsplashPhoto[];
};

export const fetchBackgrounds = action({
  args: {
    term: v.string(),
  },
  handler: async (_ctx, { term }) => {
    const query = (term || "nature").trim();
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Unsplash returned ${res.status}`);
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    const urls = data.results.map((p) => p.urls.regular);

    return { term: query, urls };
  },
});
