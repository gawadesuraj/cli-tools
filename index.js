import "dotenv/config";
import readline from "readline";
import { OpenAI } from "openai";
import axios from "axios";
import { exec } from "child_process";
import * as cheerio from "cheerio";
import { promises as fs } from "fs";
import path from "path";
import { URL } from "url";

// --- Utility Functions ---

/**
 * Extracts all valid JSON objects from a string that may contain multiple concatenated JSONs.
 * @param {string} text - The input string from the AI model.
 * @returns {Array<object>} An array of parsed JSON objects.
 */
function extractJsonObjects(text) {
  const jsonObjects = [];
  let braceCount = 0;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (braceCount === 0) {
        startIndex = i;
      }
      braceCount++;
    } else if (text[i] === "}") {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const jsonString = text.substring(startIndex, i + 1);
        try {
          jsonObjects.push(JSON.parse(jsonString));
        } catch (e) {
          console.warn(
            "Skipping malformed JSON object in response:",
            jsonString
          );
        }
        startIndex = -1;
      }
    }
  }
  return jsonObjects;
}

// --- Tool Implementations ---

/**
 * Executes a shell command.
 * @param {string} cmd - The command to execute.
 * @returns {Promise<string>} A promise that resolves with the command's output or an error message.
 */
async function executeCommand(cmd = "") {
  return new Promise((res) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return res(`Error: ${stderr || error.message}`);
      }
      res(stdout || stderr);
    });
  });
}

/**
 * Converts a web URL to a local file system path, correctly handling extension-less paths.
 * @param {string} url - The asset's full URL.
 * @param {string} outputDir - The root output directory.
 * @returns {string} The corresponding local file path.
 */
function getLocalPath(url, outputDir) {
  const urlObj = new URL(url);
  let pathname = urlObj.pathname;

  // If the path ends with '/', or has no extension, treat it as a directory and append index.html
  if (pathname.endsWith("/") || path.extname(pathname) === "") {
    pathname = path.join(pathname, "index.html");
  }

  return path.join(outputDir, decodeURIComponent(pathname));
}

/**
 * Clones a website by downloading structural assets (HTML, CSS, JS) and hotlinking dynamic assets (images, links).
 * @param {object} params - The parameters for cloning.
 * @param {string} params.url - The URL of the website to clone.
 * @param {string} [params.outputDir='cloned-site'] - The local directory for the clone.
 * @returns {Promise<string>} A promise that resolves with a success or failure message.
 */
async function cloneWebsite({ url, outputDir = "cloned-site" }) {
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
      ) {
        continue;
      }

      console.log(`Processing: ${currentUrl}`);
      processedAssets.add(currentUrl);

      const localPath = getLocalPath(currentUrl, absoluteOutputDir);
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      try {
        const isBinary = /\.(woff|woff2|ttf)$/i.test(currentUrl); // Only download fonts as binary
        const response = await axios.get(currentUrl, {
          responseType: isBinary ? "arraybuffer" : "text",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        const contentType = response.headers["content-type"] || "";
        let content = response.data;

        if (contentType.includes("text/html")) {
          const $ = cheerio.load(content);

          // FIX: Disable Next.js client-side router to make links work as standard hyperlinks.
          $('script[id="__NEXT_DATA__"]').remove();

          // Process links, scripts, and images
          $(
            'a, link[rel="stylesheet"], script[src], img[src], source[srcset]'
          ).each((i, el) => {
            const $el = $(el);
            const isLink = $el.is("a");
            const isImageTag = $el.is("img, source");
            const attr =
              isLink || $el.is("link")
                ? "href"
                : $el.is("source")
                ? "srcset"
                : "src";
            const originalValue = $el.attr(attr);

            if (!originalValue || originalValue.startsWith("data:")) return;

            const urls =
              attr === "srcset"
                ? originalValue
                    .split(",")
                    .map((part) => part.trim().split(" ")[0])
                : [originalValue];

            const rewrittenUrls = urls.map((assetUrl) => {
              if (!assetUrl) return assetUrl;
              try {
                const absoluteUrl = new URL(assetUrl, currentUrl).href;
                // Only process assets on the same domain
                if (new URL(absoluteUrl).hostname === baseHostname) {
                  // For internal links and images, leave the absolute URL to point to the live site.
                  if (isLink || isImageTag || isImage(absoluteUrl)) {
                    return absoluteUrl;
                  }
                  // For other assets (CSS, JS, Fonts), download them.
                  assetQueue.add(absoluteUrl);
                  const localAssetPath = getLocalPath(
                    absoluteUrl,
                    absoluteOutputDir
                  );
                  let relativePath = path
                    .relative(path.dirname(localPath), localAssetPath)
                    .replace(/\\/g, "/");
                  return relativePath || path.basename(localAssetPath);
                }
                return assetUrl; // Keep external URLs as is
              } catch (e) {
                console.warn(`Skipping invalid URL: ${assetUrl}`);
                return assetUrl;
              }
            });

            // Reconstruct srcset if necessary
            if (attr === "srcset") {
              let newSrcsetValue = originalValue;
              urls.forEach((oldUrl, index) => {
                if (oldUrl)
                  newSrcsetValue = newSrcsetValue.replace(
                    oldUrl,
                    rewrittenUrls[index]
                  );
              });
              $el.attr(attr, newSrcsetValue);
            } else {
              $el.attr(attr, rewrittenUrls[0]);
            }
          });

          content = $.html();
        } else if (contentType.includes("text/css")) {
          const cssUrlRegex = /url\((['"]?)(.*?)\1\)/g;
          content = content.replace(cssUrlRegex, (match, quote, assetUrl) => {
            if (assetUrl && !assetUrl.startsWith("data:")) {
              try {
                const absoluteUrl = new URL(assetUrl, currentUrl).href;
                if (new URL(absoluteUrl).hostname === baseHostname) {
                  // If it's an image, hotlink it. Otherwise, download it (e.g., fonts).
                  if (isImage(absoluteUrl)) {
                    return `url(${quote}${absoluteUrl}${quote})`;
                  }
                  assetQueue.add(absoluteUrl);
                  const localAssetPath = getLocalPath(
                    absoluteUrl,
                    absoluteOutputDir
                  );
                  let relativePath = path
                    .relative(path.dirname(localPath), localAssetPath)
                    .replace(/\\/g, "/");
                  return `url(${quote}${relativePath}${quote})`;
                }
              } catch (e) {
                console.warn(`Skipping invalid CSS URL: ${assetUrl}`);
              }
            }
            return match;
          });
        }

        await fs.writeFile(localPath, content);
      } catch (error) {
        console.warn(`⚠️ Could not process ${currentUrl}: ${error.message}`);
      }
    }
    return `Successfully created a hybrid clone of ${url} in ${absoluteOutputDir}`;
  } catch (error) {
    console.error(`Cloning failed:`, error);
    return `Failed to clone website: ${error.message}`;
  }
}

// --- Tool Registration ---
const TOOL_MAP = {
  executeCommand: executeCommand,
  cloneWebsite: cloneWebsite,
};

// --- AI Client Setup ---
const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

/**
 * Main function to run the AI agent for a given URL.
 * @param {string} url - The URL to clone.
 */
async function runAgent(url) {
  const SYSTEM_PROMPT = `
    You are an AI assistant who works on START, THINK and OUTPUT format.
    You have a list of available tools that you can call based on user query.
    For every tool call that you make, wait for the OBSERVATION from the tool.

    Available Tools:
    - executeCommand(command: string): Executes a linux/unix command and returns the output.
    - cloneWebsite({url: string, outputDir: string}): Creates a functional local version of a website. It downloads structural files like HTML, CSS, and JS, but keeps images and navigation links pointing to the live website to ensure they work correctly.

    Rules:
    - Always follow the sequence: START, THINK, TOOL, OBSERVE, THINK, OUTPUT.
    - Perform only one step at a time and wait for the next step.
    - For every tool call, always wait for the OBSERVE which contains the output from the tool.

    Output JSON Format:
    { "step": "START | THINK | OUTPUT | OBSERVE | TOOL" , "content": "string", "tool_name": "string", "input": "OBJECT | STRING" }

    Example:
    User: Can you clone the website at example.com and save it to a folder called 'my-clone'?
    ASSISTANT: { "step": "START", "content": "The user wants to clone the website example.com." }
    ASSISTANT: { "step": "THINK", "content": "I need to use the 'cloneWebsite' tool. The user provided the URL and the output directory." }
    ASSISTANT: { "step": "TOOL", "input": {"url": "https://example.com", "outputDir": "my-clone"}, "tool_name": "cloneWebsite" }
    DEVELOPER: { "step": "OBSERVE", "content": "Successfully created a hybrid clone of https://example.com in /path/to/project/my-clone" }
    ASSISTANT: { "step": "THINK", "content": "The website was cloned successfully. I should inform the user that images and links will point to the live site." }
    ASSISTANT: { "step": "OUTPUT", "content": "I have successfully created a local version of example.com in the 'my-clone' directory. To ensure functionality, all images and navigation links will point directly to the live website." }
  `;

  let outputDir;
  try {
    outputDir = new URL(url).hostname.replace(/[^a-z0-9\.]/gi, "_");
  } catch (error) {
    console.error(
      "Invalid URL provided. Please provide a full URL like 'https://example.com'"
    );
    return;
  }

  const userPrompt = `Please clone ${url} and save it in a directory called '${outputDir}'.`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "gemini-2.5-pro",
      messages: messages,
    });

    if (
      !response.choices ||
      response.choices.length === 0 ||
      !response.choices[0].message ||
      !response.choices[0].message.content
    ) {
      console.error("Invalid or empty response from the AI model:", response);
      break;
    }

    const rawContent = response.choices[0].message.content;
    const parsedObjects = extractJsonObjects(rawContent);

    if (parsedObjects.length === 0) {
      console.log(`\n🤖 [AGENT OUTPUT]:`, rawContent);
      break;
    }

    messages.push({
      role: "assistant",
      content: rawContent,
    });

    let shouldBreakLoop = false;

    for (const parsedContent of parsedObjects) {
      if (parsedContent.step === "START" || parsedContent.step === "THINK") {
        console.log(`\t🧠 [${parsedContent.step}]`, parsedContent.content);
      } else if (parsedContent.step === "TOOL") {
        const toolToCall = parsedContent.tool_name;
        const toolFunction = TOOL_MAP[toolToCall];

        if (!toolFunction) {
          const errorMsg = `There is no such tool as ${toolToCall}`;
          console.error(errorMsg);
          messages.push({
            role: "developer",
            content: JSON.stringify({ step: "OBSERVE", content: errorMsg }),
          });
          continue;
        }

        const responseFromTool = await toolFunction(parsedContent.input);
        console.log(
          `\n🛠️  [TOOL CALLED]: ${toolToCall}(${JSON.stringify(
            parsedContent.input
          )}) \n\t[OBSERVATION]: `,
          responseFromTool
        );
        messages.push({
          role: "developer",
          content: JSON.stringify({
            step: "OBSERVE",
            content: responseFromTool,
          }),
        });
      } else if (
        parsedContent.step === "OUTPUT" ||
        parsedContent.step === "FINISH"
      ) {
        console.log(`\n🤖 [AGENT OUTPUT]:`, parsedContent.content);
        shouldBreakLoop = true;
        break;
      }
    }

    if (shouldBreakLoop) {
      break;
    }
  }

  console.log("\nDone...");
}

// --- Interactive CLI using readline ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function startCli() {
  rl.question(
    'Enter the URL to clone (or type "exit" to quit): ',
    async (url) => {
      if (url.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      try {
        await runAgent(url);
      } catch (error) {
        console.error(
          `An error occurred during agent execution: ${error.message}`
        );
      } finally {
        startCli();
      }
    }
  );
}

// Start the interactive CLI
console.log("AI Website Cloner Agent Initialized.");
startCli();
