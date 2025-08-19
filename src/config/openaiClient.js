import { OpenAI } from "openai";
import "dotenv/config";
export const client = new OpenAI({
  apiKey: proces.env.GEMINI_AI_API,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
