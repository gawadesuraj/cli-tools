import axios from "axios";
import * as cheerio from "cheerio";
import { promises as fs } from "fs";
import path from "path";
import { URL } from "url";
import { getLocalPath } from "./utils.js";

export async function cloneWebsite({ url, outputDir = "cloned-site" }) {
  try {
    const assetQueue = new Set([url]);
    const processedAssets = new Set();
    const baseHostname = new URL(url).hostname;
    const absoluteOutputDir = path.resolve(process.cwd(), outputDir);

    const isImage = (assetUrl) =>
      /\.(jpg|jpeg|png|gif|svg|ico|webp)$/i.test(assetUrl);

    while (assetQueue.size > 0) {
      const currentUrl = assetQueue.values().next().value;
      assetQueue.delete(currentUrl);

      if (
        processedAssets.has(currentUrl) ||
        new URL(currentUrl).hostname !== baseHostname
      ) continue;

      console.log(`Processing: ${currentUrl}`);
      processedAssets.add(currentUrl);

      const localPath = getLocalPath(currentUrl, absoluteOutputDir);
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      try {
        const isBinary = /\.(woff|woff2|ttf)$/i.test(currentUrl);
        const response = await axios.get(currentUrl, {
          responseType: isBinary ? "arraybuffer" : "text",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124",
          },
        });

        const contentType = response.headers["content-type"] || "";
        let content = response.data;

        if (contentType.includes("text/html")) {
          const $ = cheerio.load(content);
          $('script[id="__NEXT_DATA__"]').remove();

          $('a, link[rel="stylesheet"], script[src], img[src], source[srcset]')
            .each((_, el) => {
              const $el = $(el);
              const isLink = $el.is("a");
              const isImageTag = $el.is("img, source");
              const attr =
                isLink || $el.is("link") ? "href"
                : $el.is("source")       ? "srcset"
                : "src";

              const originalValue = $el.attr(attr);
              if (!originalValue || originalValue.startsWith("data:")) return;

              const urls =
                attr === "srcset"
                  ? originalValue.split(",").map((p) => p.trim().split(" ")[0])
                  : [originalValue];

              const rewrittenUrls = urls.map((assetUrl) => {
                try {
                  const absoluteUrl = new URL(assetUrl, currentUrl).href;
                  if (new URL(absoluteUrl).hostname === baseHostname) {
                    if (isLink || isImageTag || isImage(absoluteUrl)) {
                      return absoluteUrl;
                    }
                    assetQueue.add(absoluteUrl);
                    const localAssetPath = getLocalPath(absoluteUrl, absoluteOutputDir);
                    let relativePath = path
                      .relative(path.dirname(localPath), localAssetPath)
                      .replace(/\\/g, "/");
                    return relativePath || path.basename(localAssetPath);
                  }
                  return assetUrl;
                } catch {
                  console.warn(`Skipping invalid URL: ${assetUrl}`);
                  return assetUrl;
                }
              });

              if (attr === "srcset") {
                let newSrcset = originalValue;
                urls.forEach((oldUrl, i) => {
                  newSrcset = newSrcset.replace(oldUrl, rewrittenUrls[i]);
                });
                $el.attr(attr, newSrcset);
              } else {
                $el.attr(attr, rewrittenUrls[0]);
              }
            });

          content = $.html();
        }

        await fs.writeFile(localPath, content);
      } catch (error) {
        console.warn(`⚠️ Could not process ${currentUrl}: ${error.message}`);
      }
    }
    return `Successfully created a hybrid clone of ${url} in ${absoluteOutputDir}`;
  } catch (error) {
    return `Failed to clone website: ${error.message}`;
  }
}
