import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: false,
});

const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL,
  contents: "Say hello to Solace AI in one sentence.",
});

console.log(response.text);
