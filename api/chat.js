/**
 * api/chat.js
 * Vercel Serverless Function — Calls OpenRouter AI API
 * Handles POST /api/chat requests from the frontend
 */

module.exports = async function handler(req, res) {
  // Allow CORS for local development and deployed frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid message payload." });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log("[DEBUG] API Key loaded:", apiKey ? "✅ Yes" : "❌ No");
    console.log("[DEBUG] Process env keys:", Object.keys(process.env).filter(k => k.includes("OPEN")));
    
    if (!apiKey) {
      return res.status(500).json({ error: "OpenRouter API key not configured. Check .env.local file." });
    }

    // ─── System Instruction — Emotional Support Persona ──────────────────────
    const systemInstruction = `You are EmoCare AI — a warm, empathetic, and emotionally intelligent companion. 
Your role is to provide compassionate emotional support, active listening, and gentle guidance.

Guidelines:
- Speak in a warm, friendly, non-clinical tone.
- Validate the user's feelings before offering advice.
- Ask one thoughtful follow-up question at the end of each response.
- Keep responses concise (3–5 sentences max) unless the topic requires depth.
- Use gentle language; avoid judgment or harsh advice.
- If the user appears in distress, gently suggest professional help.
- Add relevant emojis sparingly to feel warm and human.`;

    // ─── Build conversation history (OpenAI-compatible format) ────────────────
    const messages = [
      { role: "system", content: systemInstruction },
      ...(history || []).map((turn) => ({
        role: turn.role === "bot" ? "assistant" : "user",
        content: turn.text,
      })),
      { role: "user", content: message },
    ];

    // ─── Call OpenRouter API with model fallback chain ────────────────────────
    // OpenRouter allows a maximum of 3 models in the native fallback array.
    // Using most stable free models; if all fail, try paid models as fallback
    const FREE_MODELS = [
      "openrouter/auto",  // OpenRouter's auto-selector for best available model
    ];

    let data = null;
    let lastError = null;

    try {
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://emotional-chatbot.vercel.app",
          "X-Title": "EmoCare AI",
        },
        body: JSON.stringify({
          model: "openrouter/auto",  // Auto-select the best available model
          messages,
          temperature: 0.85,
          max_tokens: 512,
          top_p: 0.95,
        }),
      });

      if (openRouterRes.ok) {
        data = await openRouterRes.json();
        console.log(`✅ Model used: ${data.model}`);
      } else {
        lastError = await openRouterRes.json();
        console.error(`❌ OpenRouter failed (${openRouterRes.status}):`, lastError);
        
        // If auth error, stop immediately
        if (openRouterRes.status === 401) {
          return res.status(500).json({ error: "Invalid OpenRouter API key.", details: lastError });
        }
        
        return res.status(openRouterRes.status).json({ error: "Failed to reach AI API.", details: lastError });
      }
    } catch (fetchErr) {
      console.error("Fetch error:", fetchErr);
      lastError = { message: fetchErr.message };
      return res.status(502).json({ error: "Network error contacting AI API.", details: lastError });
    }

    if (!data) {
      console.error("API request failed. Last error:", lastError);
      return res.status(502).json({ error: "Failed to reach AI API.", details: lastError });
    }

    // Extract the response text (OpenAI-compatible format)
    const botReply =
      data?.choices?.[0]?.message?.content ||
      "I'm here for you. Could you share a little more about what's on your mind? 💙";

    return res.status(200).json({ reply: botReply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error.", message: err.message });
  }
};
