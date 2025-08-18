import { OpenAI } from "openai";
import "dotenv/config";
export const client = new OpenAI({
  apiKey: "AIzaSyB6L7O7xvY2I3czKuDRC7YUv6YktWGg_W8",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
