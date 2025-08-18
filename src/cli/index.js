import readline from "readline";
import { runAgent } from "../agents/runAgent.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function startCli() {
  rl.question('Enter URL to clone (or type "exit"): ', async (url) => {
    if (url.toLowerCase() === "exit") return rl.close();

    try {
      await runAgent(url);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    } finally {
      startCli();
    }
  });
}

console.log("AI Website Cloner Agent Initialized.");
startCli();
