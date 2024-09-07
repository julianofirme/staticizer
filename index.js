import express from "express";
import path from "path";
import { launch } from "puppeteer";
import { createClient } from "redis";
import { fileURLToPath } from "url";

const app = express();
const cache = createClient({
  url: "redis://localhost:6379",
});
await cache.connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function crawlerMiddleware(req, res, next) {
  const userAgent = req.headers["user-agent"];

  const crawlers = [
    "Googlebot",
    "Bingbot",
    "Slurp",
    "DuckDuckBot",
    "Baiduspider",
    "YandexBot",
    "Sogou",
    "Exabot",
    "facebot",
    "ia_archiver",
  ];

  const isCrawler = crawlers.some((crawler) => userAgent.includes(crawler));

  if (isCrawler) {
    console.log("Crawler detected:", userAgent);
    req.isCrawler = true;
  }

  next();
}

async function prerenderMiddleware(req, res, next) {
  if (req.isCrawler) {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    try {
      const cachedPage = await cache.get(url);
      if (cachedPage) {
        return res.send(cachedPage);
      }

      const browser = await launch();
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle0" });
      const content = await page.content();
      await browser.close();

      cache.set(url, content, "EX", 3600);

      return res.send(content);
    } catch (err) {
      return res.status(500).send("Error rendering page");
    }
  } else {
    next();
  }
}

app.use(crawlerMiddleware);
app.use(prerenderMiddleware);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
