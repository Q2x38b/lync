// Server-side scraper for video-call background images.
// Scrapes Wikimedia Commons' public search endpoint

import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_IMAGES = 20;

// Wikimedia asks scrapers to identify themselves with a real User-Agent
// per https://meta.wikimedia.org/wiki/User-Agent_policy
const UA = "lync-scraper/1.0 (school project; contact via github.com/Q2x38b/lync)";

// Only keep actual photo files
// SVGs, PDFs, audio, video, etc. that we don't want as backgrounds.
const PHOTO_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

export const fetchBackgrounds = action({
  args: {
    term: v.string(),
  },
  handler: async (_ctx, { term }) => {
    // Use the user's term, or "nature" if they didn't type anything.
    let query = term.trim();
    if (query === "") {
      query = "nature";
    }

    // Build the Wikimedia API URL piece by piece.
    //   action=query              -- standard MediaWiki query
    //   generator=search          -- use a search as the list of pages
    //   gsrsearch=<term>          -- the search term
    //   gsrnamespace=6            -- namespace 6 = File: (uploaded media)
    //   gsrlimit=<n>              -- how many results to return
    //   prop=imageinfo            -- include image metadata for each result
    //   iiprop=url                -- specifically include the URL fields
    //   iiurlwidth=1080           -- pre-resize thumburl to 1080px wide
    //   format=json               -- get JSON back instead of XML
    const url =
      "https://commons.wikimedia.org/w/api.php" +
      "?action=query" +
      "&format=json" +
      "&generator=search" +
      "&gsrsearch=" + encodeURIComponent(query) +
      "&gsrnamespace=6" +
      "&gsrlimit=" + MAX_IMAGES +
      "&prop=imageinfo" +
      "&iiprop=url" +
      "&iiurlwidth=1080";

    // Send the GET request to Wikimedia.
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Wikimedia returned " + res.status + " for \"" + query + "\"");
    }

    // Parse the response body into a plain object.
    const data: any = await res.json();

    // The response shape is roughly:
    //   { query: { pages: { "12345": { imageinfo: [{ thumburl, url }] } } } }
    // Grab the pages object, or an empty {} if it's missing.
    const pages = (data.query && data.query.pages) ? data.query.pages : {};

    // Walk through each page and collect usable photo URLs.
    const urls: string[] = [];
    for (const pageId in pages) {
      const page = pages[pageId];

      // imageinfo is an array; we want the first entry's URL.
      const info = page.imageinfo ? page.imageinfo[0] : null;
      if (!info) continue;

      // Prefer the resized thumbnail. Fall back to the full-size URL.
      const candidate = info.thumburl || info.url;
      if (!candidate) continue;

      // Skip anything that isn't a real photo (SVG, PDF, etc.).
      if (!PHOTO_EXT.test(candidate)) continue;

      urls.push(candidate);
      if (urls.length >= MAX_IMAGES) break;
    }

    return { term: query, urls };
  },
});
