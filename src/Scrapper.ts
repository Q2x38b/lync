// Unsplash background-image scraper.
// Fetches image URLs from Unsplash and saves them to src/backgrounds.json
// so the React app can use them as video-call layout backgrounds.
//
// Calls Unsplash's internal JSON endpoint (/napi/search/photos)
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

  // Write the results next to this script so the React app can import it.
  const outPath = path.join(__dirname, "backgrounds.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ term, fetchedAt: new Date().toISOString(), urls }, null, 2)
  );
}

// Read the search term from the command line, default to "nature" if none.
const term = process.argv[2] || "nature";
scrape(term);
