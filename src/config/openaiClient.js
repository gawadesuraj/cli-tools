import { OpenAI } from "openai";
import "dotenv/config";
export const client = new OpenAI({
  apiKey: proces.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
