import { client } from "../config/openaiClient.js";
import { extractJsonObjects } from "../tools/utils.js";
import { executeCommand } from "../tools/executeCommand.js";
import { cloneWebsite } from "../tools/cloneWebsite.js";
import { SYSTEM_PROMPT } from "../constants/systemPrompt.js";

const TOOL_MAP = { executeCommand, cloneWebsite };

export async function runAgent(url) {
  let outputDir;
  try {
    outputDir = new URL(url).hostname.replace(/[^a-z0-9\.]/gi, "_");
  } catch {
    console.error("Invalid URL. Use format: https://example.com");
    return;
  }

  const userPrompt = `Please clone ${url} and save it in '${outputDir}'.`;
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "gemini-2.5-pro",
      messages,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) break;

    const parsedObjects = extractJsonObjects(rawContent);
    messages.push({ role: "assistant", content: rawContent });

    let shouldBreak = false;
    for (const parsed of parsedObjects) {
      if (parsed.step === "TOOL") {
        const fn = TOOL_MAP[parsed.tool_name];
        const result = fn ? await fn(parsed.input) : `No such tool: ${parsed.tool_name}`;
        console.log(`\n🛠️ [TOOL]: ${parsed.tool_name}`, result);
        messages.push({ role: "developer", content: JSON.stringify({ step: "OBSERVE", content: result }) });
      } else if (parsed.step === "OUTPUT") {
        console.log(`\n🤖 [OUTPUT]:`, parsed.content);
        shouldBreak = true;
      }
    }
    if (shouldBreak) break;
  }
}
