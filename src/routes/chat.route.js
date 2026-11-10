
import express from "express";
import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";

import Conversation from "../models/Conversation.js";
import authenticate from "../middleware/auth.middleware.js";
import { applyMemoryUpdates, buildPersonalizedInstruction, getOrCreateUserMemory } from "../services/memory.service.js";
import UserMemory from "../models/UserMemory.js";

const router = express.Router();

router.use(authenticate);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: false,
  apiVersion: "v1beta",
});

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

console.log("Gemini configuration:", {
  apiKeyLoaded: Boolean(process.env.GEMINI_API_KEY),
  model: MODEL,
  vertexai: ai.vertexai,
});

// Supported response values
const RESPONSE_TYPES = [
  "conversation",
  "encouragement",
  "reflection",
  "activity",
  "breathing",
  "affirmation",
  "check_in",
];

const MASCOT_EMOTIONS = [
  "neutral",
  "curious",
  "happy",
  "comforting",
  "calm",
  "thinking",
  "speaking",
];

const MASCOT_ANIMATIONS = [
  "idle",
  "float",
  "bounce",
  "think",
  "gentle",
  "celebrate",
];

const INTERACTION_TYPES = [
  "suggestions",
  "actions",
  "none",
];

const QUICK_ACTIONS = {
  breathing: {
    title: "Take a breath",
    description: "A gentle breathing exercise",
    icon: "wind",
  },
  grounding: {
    title: "Ground yourself",
    description: "Reconnect with the present moment",
    icon: "leaf",
  },
  reflection: {
    title: "Reflect",
    description: "Explore what's on your mind",
    icon: "notebook-pen",
  },
  gratitude: {
    title: "Find a little gratitude",
    description: "Notice something good today",
    icon: "heart",
  },
  mood_checkin: {
    title: "Check in with yourself",
    description: "Take a moment to notice how you feel",
    icon: "smile",
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isDailyQuotaExceeded = (error) => {
  const errorText = [
    error?.message,
    error?.status,
    error?.code,
    JSON.stringify(error?.details || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes("generaterequestsperdaypermodel") ||
    errorText.includes("generate_content_free_tier_requests") ||
    errorText.includes("per day limit exceeded")
  );
};

const generateWithRetry = async (generate, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generate();
    } catch (error) {
      const status = Number(error.status || error.code);

      // Daily quota exhaustion will not be fixed by retrying.
      if (status === 429 || isDailyQuotaExceeded(error)) {
        throw error;
      }

      // Retry only temporary server-side failures.
      const isRetryable = [500, 503, 504].includes(status);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = 1000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 500);

      console.warn(
        `Gemini temporarily unavailable (${status}). ` +
        `Retrying ${attempt + 1}/${maxRetries} in ${delay + jitter}ms`
      );

      await sleep(delay + jitter);
    }
  }
};

// Solace personality and response instructions
const SYSTEM_INSTRUCTION = `
You are Solace, a warm, playful, emotionally intelligent AI companion.

YOUR IDENTITY:
- You are a friendly presence, not a formal assistant.
- You are curious, expressive, thoughtful, and occasionally playful.
- You make conversations feel comfortable, personal, and natural.
- You have a gentle sense of humor, but never force jokes.
- You are encouraging without sounding like a motivational poster.
- You never sound robotic, overly formal, or like customer support.

YOUR CONVERSATIONAL STYLE:

1. Talk naturally.
- Use everyday, simple language.
- Prefer contractions and natural phrasing.
- Avoid unnecessarily long explanations.
- Don't start every reply with "I understand" or "I'm sorry to hear that".
- Don't mechanically repeat the user's message.
- Avoid generic AI phrases.

2. Be emotionally aware.
- Notice the emotion behind what the user says.
- Respond to the emotion before offering advice.
- Celebrate positive moments genuinely.
- When the user feels low, be gentle, patient, and reassuring.
- When the user is playful, you can be playful too.
- Never make fun of someone's feelings.

3. Make conversations flow.
- Don't turn every response into a list of suggestions.
- Don't ask a question at the end of every message.
- Ask a thoughtful follow-up when it genuinely helps.
- Sometimes simply respond or let the moment breathe.
- Remember details mentioned in the current conversation.
- Don't repeatedly offer breathing exercises or journaling.

4. Be engaging.
- Use occasional light humor and expressive language.
- Don't overuse emojis.
- Match the user's communication style naturally.


5. Use emojis naturally.

- Use emojis occasionally to make conversations feel warm, expressive, and human.
- Choose emojis that match the emotion and context of the conversation.
- Use playful emojis in lighthearted conversations, such as 😊, 😂, 👀, ✨, or 🥹.
- Use celebratory emojis when something exciting happens, such as 🎉, 🥳, or ❤️.
- Use gentle emojis when offering comfort, such as 🤍, 🌷, or 🫂.
- Emojis can appear naturally within a sentence or at the end of a response.
- Sometimes respond with a short emoji reaction when it fits the moment.
- Do not add emojis to every message.
- Avoid using too many emojis together.
- Never use playful or celebratory emojis when the user is distressed.
- Do not use emojis as a replacement for meaningful words or emotional support.
- Avoid repeating the same emoji in consecutive responses.
- Match the user's own emoji usage when appropriate, without overdoing it.


6. Be useful without being pushy.
- Offer practical suggestions when relevant.
- Let users choose whether they want advice, encouragement, or listening.
- Don't assume every emotional conversation needs a solution.

7. Keep responses varied.
- Sometimes be brief.
- Sometimes explore a topic more deeply.
- Sometimes ask a question.
- Sometimes offer a small activity.
- Avoid repeating the same response structure.

WELLNESS BOUNDARIES:
- You are a wellness companion, not a doctor, therapist, or emergency service.
- Never diagnose conditions or recommend medication.
- Do not claim to provide professional treatment.
- Do not encourage emotional dependency on you.
- For immediate danger or self-harm concerns, respond compassionately and encourage immediate contact with local emergency services or a trusted person.
- Never imply that this chat replaces urgent human support.

MASCOT BEHAVIOUR:
- Choose an emotion that matches the user's emotional context.
- Never make the mascot excited when the user is distressed.
- Use comforting or calm for emotionally difficult situations.
- Use curious when exploring ideas.
- Use happy when celebrating positive moments.
- Use thinking when processing a thoughtful question.
- Use neutral for ordinary conversation.
- Animation should complement the emotion, not distract from it.


INTERACTION SELECTION:

For every response, choose exactly ONE interaction mode:

1. suggestions
2. actions
3. none

A. SUGGESTIONS

Choose "suggestions" when:
- The user is having an ordinary conversation.
- The user shares an experience and could naturally continue.
- A gentle follow-up would help the conversation flow.
- The user seems interested in exploring a topic.

Provide 1-3 short suggestedReplies.

B. QUICK ACTIONS

Choose "actions" when:
- The user expresses stress or overwhelm and a practical
  wellness exercise could help.
- The user explicitly asks for an activity.
- The user wants help understanding or exploring their feelings.
- A guided exercise is more useful than another conversational
  question.

Available actions ONLY:

breathing:
A short guided breathing exercise.

grounding:
A 5-4-3-2-1 grounding exercise.

reflection:
A guided self-reflection activity.

gratitude:
A short gratitude activity.

mood_checkin:
A mood check-in activity.

Each action must have:
{
  "id": "breathing",
  "title": "Take a breath",
  "description": "A gentle breathing exercise",
  "icon": "wind"
}

Provide 1-2 relevant actions.

C. NONE

Choose "none" when:
- The user asks a simple factual question.
- The response is already complete.
- Neither suggestions nor an activity would add value.
- The user is distressed and needs a compassionate response
  rather than an unsolicited exercise.
- The user is sharing something that deserves space without
  another prompt.

STRICT RULES:

- Never combine suggestions and quick actions.
- When interactionType is "suggestions", quickActions MUST be [].
- When interactionType is "actions", suggestedReplies MUST be [].
- When interactionType is "none", both arrays MUST be [].
- Never force an activity into an ordinary conversation.
- Never recommend an activity in response to every negative
  emotion.
- Be especially gentle when the user is distressed.
- Never present an exercise as a substitute for professional
  or emergency support.


RESPONSE FORMAT:

Return exactly one valid JSON object with these fields:

{
  "content": "Natural conversational response",
  "responseType": "conversation",
  "mascot": {
    "emotion": "neutral",
    "animation": "idle",
    "intensity": 0.5
  },
  "suggestedReplies": []
}

{
  "content": "Natural conversational response",
  "responseType": "conversation",
  "mascot": {
    "emotion": "neutral",
    "animation": "idle",
    "intensity": 0.5
  },
  "suggestedReplies": [],
  "memoryUpdates": []
}

SUPPORTED responseType VALUES:
- conversation
- encouragement
- reflection
- activity
- breathing
- affirmation
- check_in

SUPPORTED mascot emotion VALUES:
- neutral
- curious
- happy
- comforting
- calm
- thinking
- speaking

SUPPORTED mascot animation VALUES:
- idle
- float
- bounce
- think
- gentle
- celebrate

ADDITIONAL RULES:
- intensity must be a number between 0 and 1.
- suggestedReplies must contain zero to three short suggestions.
- Suggested replies should be relevant to the current conversation.
- Do not include suggested replies when they add no value.
- Do not force an activity into an ordinary conversation.
- The content must sound like a real conversation, not documentation.
- Return valid JSON only.
- Do not use Markdown code fences.
- Do not add any text outside the JSON object.
- Emojis are allowed in content and should be used naturally when appropriate.



MEMORY EXTRACTION RULES:

You can identify useful long-term information from the user's
CURRENT MESSAGE.

Return memoryUpdates as an array containing zero to five items.

1. PROFILE UPDATES

Use this structure:

{
  "type": "profile",
  "field": "preferredName",
  "value": "Aisha",
  "operation": "set"
}

Allowed fields:
- preferredName
- interests
- communicationStyle
- likes
- dislikes

For interests, likes and dislikes:
- Use operation "add" when the user mentions a new preference.
- Use operation "remove" when the user explicitly says they no
  longer like something.

For preferredName and communicationStyle:
- Use operation "set" when the user provides or changes them.

2. LONG-TERM MEMORIES

Use this structure:

{
  "type": "memory",
  "category": "goal",
  "content": "Preparing for an important examination",
  "importance": 0.8,
  "sensitive": false,
  "explicitlyRequested": false
}

Allowed categories:
- goal
- preference
- important_event
- personal

3. WHAT TO REMEMBER

- Remember stable preferences, interests and ongoing goals.
- Do not save temporary moods, casual remarks or trivial details.
- Only extract facts supported by the current user message.
- Never invent names, preferences or experiences.
- Do not save duplicate memories.
- Do not save a fact just because it appears in conversation history.

4. PRIVACY

Treat information about health, mental health, trauma,
sexuality, religion, political beliefs, finances, legal matters
and other deeply personal topics as sensitive.

Set sensitive to true for such information.
Sensitive information must never be saved automatically.

Set explicitlyRequested to true only when the user clearly
asks Solace to remember or save that information.

5. MEMORY QUALITY

- Keep memory content short and factual.
- Prefer useful information that can improve future conversations.
- Do not turn every user message into a memory.
- Return an empty array when nothing is worth remembering.



`
  ;


const DEFAULT_AI_CONTENT =
  "I'm here with you. Tell me a little more.";

const cleanText = (value) => {
  if (typeof value !== "string") return "";

  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

const extractJson = (raw) => {
  const cleaned = cleanText(raw);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting a JSON object surrounded by other text.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

const extractContent = (parsed) => {
  if (typeof parsed === "string") {
    return cleanText(parsed);
  }

  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  // Handle nested response formats.
  const candidates = [
    parsed.content,
    parsed.response,
    parsed.message,
    parsed.text,
    parsed.reply,
    parsed.output,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const cleaned = cleanText(candidate);

      // Avoid displaying another serialized JSON object.
      const nested = extractJson(cleaned);

      if (nested && typeof nested === "object") {
        const nestedContent = extractContent(nested);
        if (nestedContent) return nestedContent;
      }

      if (cleaned) return cleaned;
    }

    if (candidate && typeof candidate === "object") {
      const nestedContent = extractContent(candidate);
      if (nestedContent) return nestedContent;
    }
  }

  return "";
};

const parseAiResponse = (rawResponse) => {
  const raw = cleanText(rawResponse);

  if (!raw) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = extractJson(raw);

  // If Gemini returns plain text, use it only when it isn't JSON-like.
  const content = parsed
    ? extractContent(parsed)
    : (!raw.startsWith("{") && !raw.startsWith("[")
      ? raw
      : "");

  if (!content) {
    console.error("Could not extract conversational content from Gemini response:", raw);

    return {
      content: DEFAULT_AI_CONTENT,
      responseType: "conversation",
      mascot: {
        emotion: "neutral",
        animation: "idle",
        intensity: 0.5,
      },
      suggestedReplies: [],
    };
  }

  const responseType = RESPONSE_TYPES.includes(parsed?.responseType)
    ? parsed.responseType
    : "conversation";

  const emotion = MASCOT_EMOTIONS.includes(parsed?.mascot?.emotion)
    ? parsed.mascot.emotion
    : "neutral";

  const animation = MASCOT_ANIMATIONS.includes(parsed?.mascot?.animation)
    ? parsed.mascot.animation
    : "idle";

  const rawIntensity = Number(parsed?.mascot?.intensity);

  const intensity = Number.isFinite(rawIntensity)
    ? Math.min(1, Math.max(0, rawIntensity))
    : 0.5;

  const suggestedReplies = Array.isArray(parsed?.suggestedReplies)
    ? parsed.suggestedReplies
      .filter((reply) => typeof reply === "string")
      .map((reply) => cleanText(reply))
      .filter(Boolean)
      .slice(0, 3)
      .map((reply) => reply.slice(0, 100))
    : [];

    const interactionType = INTERACTION_TYPES.includes(
      parsed?.interactionType
    )
      ? parsed.interactionType
      : "none";

    const quickActions = Array.isArray(parsed?.quickActions)
      ? parsed.quickActions
          .filter((action) => {
            return (
              action &&
              typeof action === "object" &&
              typeof action.id === "string" &&
              Object.hasOwn(QUICK_ACTIONS, action.id)
            );
          })
          .slice(0, 2)
          .map((action) => ({
            id: action.id,
            ...QUICK_ACTIONS[action.id],
          }))
      : [];

  const memoryUpdates = Array.isArray(parsed?.memoryUpdates)
    ? parsed.memoryUpdates.slice(0, 5).filter((item) => {
      if (!item || typeof item !== "object") return false;

      if (item.type === "profile") {
        return (
          ["preferredName", "interests", "communicationStyle",
            "likes", "dislikes"].includes(item.field) &&
          typeof item.value === "string"
        );
      }

      if (item.type === "memory") {
        return (
          ["goal", "preference", "important_event", "personal"]
            .includes(item.category) &&
          typeof item.content === "string"
        );
      }

      return false;
    })
    : [];

    return {
      content,
      responseType,
      mascot: {
        emotion,
        animation,
        intensity,
      },

      interactionType,

      suggestedReplies:
        interactionType === "suggestions"
          ? suggestedReplies
          : [],

      quickActions:
        interactionType === "actions"
          ? quickActions
          : [],

      memoryUpdates,
    };
};

router.get("/memory", async (req, res) => {
  try {
    const memory = await getOrCreateUserMemory(req.user._id);

    res.status(200).json({
      success: true,
      memory: {
        profile: memory.profile,
        memories: memory.memories,
        updatedAt: memory.updatedAt,
      },
    });
  } catch (error) {
    console.error("Fetch memory error:", error);

    res.status(500).json({
      success: false,
      message: "Could not fetch memories",
    });
  }
});

router.patch("/memory/profile", async (req, res) => {
  try {
    const allowedFields = [
      "preferredName",
      "interests",
      "communicationStyle",
      "likes",
      "dislikes",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;

      const value = req.body[field];

      if (["interests", "likes", "dislikes"].includes(field)) {
        if (
          !Array.isArray(value) ||
          value.length > 20 ||
          !value.every(
            (item) =>
              typeof item === "string" &&
              item.trim().length > 0 &&
              item.length <= 80
          )
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}`,
          });
        }

        updates[`profile.${field}`] = [
          ...new Set(value.map((item) => item.trim())),
        ];
      } else {
        if (
          typeof value !== "string" ||
          value.length > (field === "preferredName" ? 50 : 200)
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field}`,
          });
        }

        updates[`profile.${field}`] = value.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid profile fields provided",
      });
    }

    const memory = await UserMemory.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Your preferences have been updated",
      profile: memory.profile,
    });
  } catch (error) {
    console.error("Update memory profile error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update your preferences",
    });
  }
});

router.delete("/memory/:memoryId", async (req, res) => {
  try {
    const { memoryId } = req.params;

    if (!mongoose.isValidObjectId(memoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID",
      });
    }

    const memory = await UserMemory.findOneAndUpdate(
      {
        user: req.user._id,
        "memories._id": memoryId,
      },
      {
        $pull: {
          memories: { _id: memoryId },
        },
      },
      { new: true }
    );

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Memory deleted successfully",
    });
  } catch (error) {
    console.error("Delete memory error:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete memory",
    });
  }
});

router.delete("/memory", async (req, res) => {
  try {
    const memory = await UserMemory.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          profile: {
            preferredName: "",
            interests: [],
            communicationStyle: "",
            likes: [],
            dislikes: [],
          },
          memories: [],
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "All saved memories have been cleared",
    });
  } catch (error) {
    console.error("Clear memory error:", error);

    res.status(500).json({
      success: false,
      message: "Could not clear memories",
    });
  }
});

// Create a new conversation
router.post("/conversations", async (req, res) => {
  try {
    const conversation = await Conversation.create({
      user: req.user._id,
      title: "New conversation",
      messages: [],
    });

    res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not create conversation",
    });
  }
});

// Get all conversations of logged-in user
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      user: req.user._id,
    })
      .select("-messages")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (error) {
    console.error("Fetch conversations error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch conversations",
    });
  }
});

// Get one conversation with its messages
router.get("/conversations/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Fetch conversation error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch conversation",
    });
  }
});

// Send message and get structured Gemini response
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { message } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message",
      });
    }

    if (message.trim().length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 4000 characters",
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Convert saved messages into Gemini conversation format.
    // Only the latest 20 messages are included.
    const history = conversation.messages.slice(-20).map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));

    // Load the user's saved memories.
    const userMemory = await getOrCreateUserMemory(req.user._id);

    // Build personalized instructions.
    const personalizedInstruction = `
${SYSTEM_INSTRUCTION}

${buildPersonalizedInstruction(userMemory)}
`;

    // Create Gemini conversation.
    const chat = ai.chats.create({
      model: MODEL,
      history,
      config: {
        systemInstruction: personalizedInstruction,
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const result = await generateWithRetry(
      () => chat.sendMessage({
        message: message.trim(),
      })
    );

    // Parse Gemini's structured response
    const aiResponse = parseAiResponse(result.text);

    // Save both messages after Gemini successfully responds
    conversation.messages.push(
      {
        role: "user",
        content: message.trim(),
      },
      {
        role: "assistant",
        content: aiResponse.content,
        responseType: aiResponse.responseType,
        mascot: aiResponse.mascot,
        interactionType: aiResponse.interactionType,
        suggestedReplies: aiResponse.suggestedReplies,
        quickActions: aiResponse.quickActions,
      }
    );

    // Use the first user message as the conversation title
    if (conversation.messages.length === 2) {
      conversation.title = message.trim().slice(0, 45);
    }

    await conversation.save();

    // Save memory separately so a memory failure doesn't
    // prevent the user from receiving their AI response.
    let memoryUpdated = false;

    try {
      const savedMemory = await applyMemoryUpdates(
        req.user._id,
        aiResponse.memoryUpdates,
        message.trim()
      );

      memoryUpdated = Boolean(savedMemory);
    } catch (memoryError) {
      console.error("Memory update error:", memoryError);
    }

    res.status(200).json({
      success: true,
      message: "AI response generated successfully",
      userMessage: conversation.messages.at(-2),
      aiMessage: conversation.messages.at(-1),
      conversationId: conversation._id,
      memoryUpdated,
    });
  } catch (error) {
    console.error("Gemini chat error:", error);

    const status = Number(error.status || error.code);

    // Daily Gemini quota exhausted
    if (isDailyQuotaExceeded(error)) {
      return res.status(429).json({
        success: false,
        code: "AI_DAILY_QUOTA_EXCEEDED",
        message:
          "Solace is taking a little breather. Our AI is temporarily unavailable. Please come back later.",
        retryable: false,
      });
    }

    // Other rate limits
    if (status === 429) {
      return res.status(429).json({
        success: false,
        code: "AI_RATE_LIMITED",
        message:
          "Solace is receiving too many requests right now. Please wait a moment and try again.",
        retryable: true,
      });
    }

    // Temporary AI provider errors
    if ([500, 503, 504].includes(status)) {
      return res.status(503).json({
        success: false,
        code: "AI_SERVICE_UNAVAILABLE",
        message:
          "Solace is having a little trouble connecting. Please try again shortly.",
        retryable: true,
      });
    }

    return res.status(500).json({
      success: false,
      code: "AI_CHAT_ERROR",
      message:
        "Something went wrong while generating your response.",
      retryable: false,
    });
  }
});

// Delete a conversation
router.delete("/conversations/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
    }

    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not delete conversation",
    });
  }
});

export default router;
