// Server-side scraper for video-call background images.
//
// Scrapes Wikimedia Commons' public search endpoint. Wikimedia is built
// to welcome programmatic access -- no key, no auth, no IP blocking, no
// proxies. Single HTTP call per query.

import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_IMAGES = 20;

// Wikimedia asks scrapers to identify themselves with a real User-Agent
// per https://meta.wikimedia.org/wiki/User-Agent_policy
const UA = "lync-scraper/1.0 (school project; contact via github.com/Q2x38b/lync)";

// Only keep actual photo files -- Wikimedia's namespace 6 also returns
// SVGs, PDFs, audio, video, etc. that we don't want as backgrounds.
// Matches when the extension is followed by either "?" (URL has a query
// string) or end-of-string -- Wikimedia thumb URLs append utm_* params.
const PHOTO_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

type WikimediaPage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
  }>;
};

type WikimediaResponse = {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
};

export const fetchBackgrounds = action({
  args: {
    term: v.string(),
  },
  handler: async (_ctx, { term }) => {
    const query = (term || "nature").trim();

    // Build the API URL. Walkthrough of params:
    //   action=query              -- standard MediaWiki query
    //   generator=search          -- use a search as the list of pages
    //   gsrsearch=<term>          -- the search term
    //   gsrnamespace=6            -- namespace 6 = File: (uploaded media)
    //   gsrlimit=<n>              -- how many results to return
    //   prop=imageinfo            -- include image metadata for each result
    //   iiprop=url                -- specifically include the URL fields
    //   iiurlwidth=1080           -- pre-resize thumburl to 1080px wide
    //   format=json               -- get JSON back instead of XML
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: String(MAX_IMAGES),
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "1080",
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Wikimedia returned ${res.status} for "${query}"`);
    }

    const data = (await res.json()) as WikimediaResponse;
    const pages = data.query?.pages ?? {};

    const urls: string[] = [];
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      const candidate = info?.thumburl ?? info?.url;
      if (!candidate) continue;
      if (!PHOTO_EXT.test(candidate)) continue;
      urls.push(candidate);
      if (urls.length >= MAX_IMAGES) break;
    }

    if (urls.length === 0) {
      throw new Error(`No images found on Wikimedia for "${query}"`);
    }

    return { term: query, urls };
  },
});
