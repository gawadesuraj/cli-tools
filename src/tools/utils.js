import path from "path";
import { URL } from "url";

/**
 * Extracts all valid JSON objects from a string that may contain multiple concatenated JSONs.
 */
export function extractJsonObjects(text) {
  const jsonObjects = [];
  let braceCount = 0;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (text[i] === "}") {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const jsonString = text.substring(startIndex, i + 1);
        try {
          jsonObjects.push(JSON.parse(jsonString));
        } catch {
          console.warn("Skipping malformed JSON:", jsonString);
        }
        startIndex = -1;
      }
    }
  }
  return jsonObjects;
}

/**
 * Converts a web URL to a local file system path.
 */
export function getLocalPath(url, outputDir) {
  const urlObj = new URL(url);
  let pathname = urlObj.pathname;

  if (pathname.endsWith("/") || path.extname(pathname) === "") {
    pathname = path.join(pathname, "index.html");
  }
  return path.join(outputDir, decodeURIComponent(pathname));
}
