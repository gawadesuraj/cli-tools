import { exec } from "child_process";

/**
 * Executes a shell command.
 */
export async function executeCommand(cmd = "") {
  return new Promise((res) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return res(`Error: ${stderr || error.message}`);
      }
      res(stdout || stderr);
    });
  });
}
