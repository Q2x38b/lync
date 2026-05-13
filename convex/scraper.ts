// Server-side scraper for Unsplash background images.

import { action } from "./_generated/server";
import { v } from "convex/values";

// Cap on how many image URLs we return from a single scrape.
const MAX_IMAGES = 20;

// Matches direct CDN photo URLs of the form:
//   https://images.unsplash.com/photo-<id>?<query-string>
// Stops at the first quote, whitespace, or backslash so we don't
// drag in trailing HTML/JSON garbage.
const IMG_URL_REGEX =
  /https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9_-]+(?:\?[^"'\s\\]*)?/g;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  // Hint Jina to return raw HTML instead of its default markdown summary.
  // Other proxies just ignore this header.
  "X-Return-Format": "html",
};

// Unsplash 401s direct requests from Convex's serverless IPs. Route through
// free public fetch-proxies whose IPs aren't blocked. We're still scraping
// Unsplash HTML -- the proxies are intermediate hops.
async function fetchUnsplashHtml(targetUrl: string): Promise<string> {
  const attempts: { label: string; url: string }[] = [
    // Jina reader -- generally the most reliable of the free public proxies,
    // purpose-built for fetching web content from non-blocked IPs.
    { label: "jina", url: `https://r.jina.ai/${targetUrl}` },
    // CodeTabs -- separate operator, useful when Jina rate-limits.
    {
      label: "codetabs",
      url: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`,
    },
    // Direct attempt -- cheap and one day Unsplash might unblock the IP.
    { label: "direct", url: targetUrl },
    {
      label: "allorigins",
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    },
    {
      label: "corsproxy",
      url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        errors.push(`${attempt.label}: HTTP ${res.status}`);
        continue;
      }
      const body = await res.text();
      // Sanity check: did we get content that contains Unsplash photo URLs?
      // (Works on both raw HTML and Jina's markdown output -- URLs survive
      // either representation.)
      if (body.includes("images.unsplash.com/photo-")) {
        return body;
      }
      errors.push(`${attempt.label}: no photo URLs in response`);
    } catch (err) {
      errors.push(
        `${attempt.label}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(`All scrape attempts failed -- ${errors.join("; ")}`);
}

export const fetchBackgrounds = action({
  args: {
    term: v.string(),
  },
  handler: async (_ctx, { term }) => {
    const query = (term || "nature").trim();
    const targetUrl = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;

    const html = await fetchUnsplashHtml(targetUrl);

    // Pull every CDN image URL out of the HTML, dedupe by photo id, and
    // rewrite each to a consistent 1080px width.
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const match of html.matchAll(IMG_URL_REGEX)) {
      const idMatch = match[0].match(/photo-([A-Za-z0-9_-]+)/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (seen.has(id)) continue;
      seen.add(id);
      urls.push(`https://images.unsplash.com/photo-${id}?w=1080&q=80`);
      if (urls.length >= MAX_IMAGES) break;
    }

    if (urls.length === 0) {
      throw new Error(`No images found on Unsplash search page for "${query}"`);
    }

    return { term: query, urls };
  },
});
