// Unsplash background-image scraper.
//
// Run from the terminal:
//     npx tsx src/Scrapper.ts mountains
//
// It gathers image URLs from Unsplash, prints them to the terminal, and
// saves them to src/backgrounds.json so the React app can use the first
// one as the video-call layout background.
//
// The old version used cheerio to parse Unsplash's HTML. That didn't work
// because Unsplash is a JavaScript SPA -- the raw HTML is empty. This
// version calls Unsplash's internal JSON endpoint (/napi/search/photos)
// instead, which returns the photos directly.

// axios: HTTP client used to send the GET request.
import axios from "axios";
// fs: lets us write the results to a file.
import * as fs from "fs";
// path: builds file paths that work on any OS.
import * as path from "path";

// The fields we care about from one photo in Unsplash's response.
type UnsplashPhoto = {
  urls: { regular: string; small: string; full: string };
  alt_description: string | null;
};

// The shape of the whole search response.
type UnsplashSearchResponse = {
  total: number;
  results: UnsplashPhoto[];
};

async function scrape(term: string) {
  // Build the request URL. encodeURIComponent handles spaces/special chars.
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(term)}&per_page=20`;

  // Send the GET request. The User-Agent header makes Unsplash treat us
  // like a normal browser instead of a bot.
  const { data } = await axios.get<UnsplashSearchResponse>(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  // Pull just the image URL out of each photo object.
  const urls = data.results.map((p) => p.urls.regular);

  // Notify (terminal): print a summary plus each URL.
  console.log(`Found ${urls.length} backgrounds for "${term}"`);
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  // Notify (file): write the results next to this script so the React app
  // can import it. JSON.stringify(..., null, 2) pretty-prints the file.
  const outPath = path.join(__dirname, "backgrounds.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ term, fetchedAt: new Date().toISOString(), urls }, null, 2)
  );
  console.log(`Wrote ${urls.length} URLs to ${outPath}`);
}

// Read the search term from the command line, default to "nature" if none.
const term = process.argv[2] || "nature";

// Run the scraper and print a clean error message if anything fails.
scrape(term).catch((err) => {
  console.error("Scrape failed:", err.message);
  process.exit(1);
});
