import axios from "axios";
import * as cheerio from "cheerio";

async function scrape(term: string) {
  const { data } = await axios.get(`https://unsplash.com/s/photos/${term}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const $ = cheerio.load(data);

  $("img").each((_i, el) => {
    const src = $(el).attr("src") || "";
    if (src.includes("images.unsplash.com") && src.includes("photo-")) {
      console.log(src);
    }
  });
}

scrape("");