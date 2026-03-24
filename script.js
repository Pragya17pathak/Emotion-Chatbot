/**
 * script.js — EmoCare AI
 * ─────────────────────────────────────────────────────────
 * Emotion-Aware Chatbot Frontend Logic
 * Features:
 *   - Emotion detection with keyword matching
 *   - Dynamic emotion badge rendering
 *   - Dark mode toggle (localStorage)
 *   - Chat messaging with history
 *   - Typing indicator
 *   - Follow-up question chips
 *   - Quick suggestion chips
 *   - Emoji picker
 *   - Auto-resizing textarea
 *   - Scroll management
 * ─────────────────────────────────────────────────────────
 */

"use strict";

/* ═══════════════════════════════════════════════════
   1. CONSTANTS & CONFIG
═══════════════════════════════════════════════════ */

/** API endpoint for the Vercel serverless function */
const API_ENDPOINT = "/api/chat";

/** Max conversation history to send to backend (to save tokens) */
const MAX_HISTORY = 10;

/** Follow-up questions to append after each bot response */
const FOLLOWUP_QUESTIONS = [
  "Can you tell me more about what happened?",
  "How long have you been feeling this way?",
  "What do you think caused this feeling?",
  "Is there anything specific that's been on your mind?",
  "How does this situation make you feel on a scale of 1–10?",
  "Have you spoken to anyone else about this?",
  "What would make you feel a little better right now?",
  "What has been the hardest part about this for you?",
];

/** Emoji set for the emoji picker */
const EMOJI_LIST = [
  "😊","😔","😟","😠","😰","😢","🥺","😤",
  "😌","🤗","😮","🤔","😴","😅","🥹","😍",
  "💙","💜","❤️","🧡","💚","💛","🤍","🖤",
  "🌿","🌸","🌈","⭐","✨","🌙","☀️","🌊",
  "🙏","👍","🤝","💪","🎯","🌺","🕊️","🫂",
];

/** Emotion detection keyword map */
const EMOTION_MAP = [
  {
    key: "happy",
    keywords: ["happy", "great", "good", "wonderful", "amazing", "awesome", "fantastic",
               "joy", "joyful", "excited", "excellent", "love", "loved", "glad", "blessed",
               "grateful", "thankful", "cheerful", "ecstatic", "elated", "positive", "delighted"],
    emoji: "😊",
    label: "Happy",
  },
  {
    key: "excited",
    keywords: ["excited", "thrilled", "pumped", "stoked", "can't wait", "hyped", "eager",
               "enthusiastic", "energetic", "overjoyed"],
    emoji: "🤩",
    label: "Excited",
  },
  {
    key: "sad",
    keywords: ["sad", "fail", "upset", "unhappy", "depressed", "down", "miserable",
               "heartbroken", "cry", "crying", "tears", "grief", "loss", "lost",
               "hopeless", "helpless", "worthless", "hurt", "broken", "empty"],
    emoji: "😔",
    label: "Sad",
  },
  {
    key: "lonely",
    keywords: ["lonely", "alone", "isolated", "nobody", "no one", "friendless",
               "abandoned", "unwanted", "left out", "forgotten", "neglected"],
    emoji: "🥺",
    label: "Lonely",
  },
  {
    key: "stressed",
    keywords: ["stress", "stressed", "pressure", "overwhelmed", "burnout", "burn out",
               "exhausted", "drained", "tired", "overworked", "too much", "deadline",
               "can't cope", "falling apart", "breaking down"],
    emoji: "😟",
    label: "Stressed",
  },
  {
    key: "anxious",
    keywords: ["anxious", "anxiety", "worry", "worried", "nervous", "scared", "fear",
               "afraid", "panic", "panicking", "uneasy", "restless", "terrified",
               "dread", "overthinking", "can't sleep", "sleepless"],
    emoji: "😰",
    label: "Anxious",
  },
  {
    key: "angry",
    keywords: ["angry", "mad", "furious", "rage", "rage", "frustrated", "frustrating",
               "annoyed", "irritated", "fed up", "hate", "disgusted", "outraged",
               "boiling", "livid"],
    emoji: "😠",
    label: "Angry",
  },
];

/** Default/fallback emotion */
const DEFAULT_EMOTION = { key: "neutral", emoji: "😐", label: "Neutral" };

/* ═══════════════════════════════════════════════════
   2. STATE
═══════════════════════════════════════════════════ */
let conversationHistory = [];   // { role: 'user'|'bot', text: string }[]
let currentEmotion = DEFAULT_EMOTION;
let isWaiting = false;          // Prevent duplicate sends while awaiting API

/* ═══════════════════════════════════════════════════
   3. DOM REFERENCES
═══════════════════════════════════════════════════ */
const chatMessages   = document.getElementById("chatMessages");
const chatInput      = document.getElementById("chatInput");
const sendBtn        = document.getElementById("sendBtn");
const typingIndicator = document.getElementById("typingIndicator");
const emotionBadge   = document.getElementById("emotionBadge");
const emotionEmoji   = document.getElementById("emotionEmoji");
const emotionText    = document.getElementById("emotionText");
const themeToggle    = document.getElementById("themeToggle");
const suggestionChips = document.getElementById("suggestionChips");
const emojiBtn       = document.getElementById("emojiBtn");
const emojiPanel     = document.getElementById("emojiPanel");
const emojiGrid      = document.getElementById("emojiGrid");
const charCounter    = document.getElementById("charCounter");

/* ═══════════════════════════════════════════════════
   4. EMOTION DETECTION
═══════════════════════════════════════════════════ */

/**
 * detectEmotion(message)
 * Scans a message string for emotion-related keywords.
 * Returns the best matching emotion object.
 * @param {string} message
 * @returns {{ key: string, emoji: string, label: string }}
 */
function detectEmotion(message) {
  if (!message || typeof message !== "string") return DEFAULT_EMOTION;

  const normalized = message.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const emotion of EMOTION_MAP) {
    let score = 0;
    for (const keyword of emotion.keywords) {
      // Use word-boundary-ish matching (index check is fine for UX level)
      if (normalized.includes(keyword)) {
        score += keyword.length; // longer keyword = more specific = higher score
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = emotion;
    }
  }

  return bestMatch || DEFAULT_EMOTION;
}

/**
 * updateEmotionBadge(emotion)
 * Updates the persistent emotion bar at the top with detected emotion.
 * @param {{ key: string, emoji: string, label: string }} emotion
 */
function updateEmotionBadge(emotion) {
  // Remove all existing classes, re-apply base + new key
  emotionBadge.className = `emotion-badge ${emotion.key}`;
  emotionEmoji.textContent = emotion.emoji;
  emotionText.textContent  = emotion.label;

  // Pulse animation on change
  emotionBadge.style.animation = "none";
  requestAnimationFrame(() => {
    emotionBadge.style.animation = "badgePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
  });
}

/* ═══════════════════════════════════════════════════
   5. DARK MODE
═══════════════════════════════════════════════════ */

/** Apply theme and save to localStorage */
function applyTheme(isDark) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem("emocare-theme", isDark ? "dark" : "light");
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

/** Toggle between dark and light */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  applyTheme(currentTheme !== "dark");
}

/** Load saved theme preference on boot */
function initTheme() {
  const saved = localStorage.getItem("emocare-theme");
  if (saved) {
    applyTheme(saved === "dark");
  } else {
    // Auto-detect system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark);
  }
}

/* ═══════════════════════════════════════════════════
   6. TIME FORMATTING
═══════════════════════════════════════════════════ */

/** Format current time as HH:MM AM/PM */
function formatTime() {
  return new Date().toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* ═══════════════════════════════════════════════════
   7. SCROLL
═══════════════════════════════════════════════════ */

/** Scroll chat to the latest message */
function scrollToBottom(smooth = true) {
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
}

/* ═══════════════════════════════════════════════════
   8. TYPING INDICATOR
═══════════════════════════════════════════════════ */

function showTyping() {
  typingIndicator.classList.add("visible");
  typingIndicator.setAttribute("aria-hidden", "false");
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.classList.remove("visible");
  typingIndicator.setAttribute("aria-hidden", "true");
}

/* ═══════════════════════════════════════════════════
   9. PICK A FOLLOW-UP QUESTION
═══════════════════════════════════════════════════ */

/**
 * Pick a random follow-up question (avoids immediate repetition).
 * @returns {string}
 */
let _lastFollowupIdx = -1;
function pickFollowup() {
  let idx;
  do {
    idx = Math.floor(Math.random() * FOLLOWUP_QUESTIONS.length);
  } while (idx === _lastFollowupIdx && FOLLOWUP_QUESTIONS.length > 1);
  _lastFollowupIdx = idx;
  return FOLLOWUP_QUESTIONS[idx];
}

/* ═══════════════════════════════════════════════════
   10. MESSAGE RENDERING
═══════════════════════════════════════════════════ */

/**
 * appendUserMessage(text)
 * Adds a user bubble to the chat.
 * @param {string} text
 */
function appendUserMessage(text) {
  const row = document.createElement("div");
  row.className = "message-row user";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "🧑";

  const group = document.createElement("div");
  group.className = "message-group";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = formatTime();

  group.appendChild(bubble);
  group.appendChild(time);
  row.appendChild(group);
  row.appendChild(avatar);

  chatMessages.appendChild(row);
  scrollToBottom();
}

/**
 * appendBotMessage(text, emotion)
 * Adds a bot bubble to the chat with an emotion badge and follow-up chips.
 * @param {string} text
 * @param {{ key: string, emoji: string, label: string }} emotion
 */
function appendBotMessage(text, emotion) {
  const row = document.createElement("div");
  row.className = "message-row bot";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "🌿";

  const group = document.createElement("div");
  group.className = "message-group";

  // ── Bubble ──
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  // Bot text (support simple line breaks)
  const textNode = document.createElement("p");
  textNode.style.margin = "0";
  textNode.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
  bubble.appendChild(textNode);

  // ── Emotion badge inside bubble ──
  const badgeEl = document.createElement("div");
  badgeEl.className = `bubble-emotion-badge ${emotion.key}`;
  badgeEl.textContent = `${emotion.emoji} ${emotion.label}`;
  bubble.appendChild(badgeEl);

  // ── Follow-up question chip ──
  const followup = pickFollowup();
  const chipsContainer = document.createElement("div");
  chipsContainer.className = "followup-chips";

  const chip = document.createElement("button");
  chip.className = "followup-chip";
  chip.textContent = `💭 ${followup}`;
  chip.addEventListener("click", () => {
    chatInput.value = followup;
    autoResizeInput();
    updateSendButton();
    chatInput.focus();
  });

  chipsContainer.appendChild(chip);
  bubble.appendChild(chipsContainer);

  // ── Timestamp ──
  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = `EmoCare AI · ${formatTime()}`;

  group.appendChild(bubble);
  group.appendChild(time);
  row.appendChild(avatar);
  row.appendChild(group);

  chatMessages.appendChild(row);
  scrollToBottom();
}

/**
 * escapeHtml(str) — prevents XSS injection
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ═══════════════════════════════════════════════════
   11. WELCOME MESSAGE
═══════════════════════════════════════════════════ */

function renderWelcomeMessage() {
  const card = document.createElement("div");
  card.className = "welcome-card";
  card.innerHTML = `
    <div class="welcome-icon" aria-hidden="true">🌿</div>
    <h2 class="welcome-title">Hi, I'm EmoCare AI 💙</h2>
    <p class="welcome-subtitle">
      A safe, judgment-free space just for you. I'm here to listen, understand,
      and support you through whatever you're feeling.
      <br><br>
      <strong>Start by sharing what's on your mind</strong>, or pick a quick option below.
    </p>
  `;
  chatMessages.appendChild(card);
}

/* ═══════════════════════════════════════════════════
   12. SEND MESSAGE FLOW
═══════════════════════════════════════════════════ */

/**
 * sendMessage()
 * Orchestrates the full send → detect → API → render pipeline.
 */
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isWaiting) return;

  isWaiting = true;
  sendBtn.disabled = true;

  // 1. Clear input
  chatInput.value = "";
  autoResizeInput();
  charCounter.textContent = "0/1000";

  // 2. Detect emotion from user message
  const emotion = detectEmotion(text);
  currentEmotion = emotion;
  updateEmotionBadge(emotion);

  // 3. Render user bubble
  appendUserMessage(text);

  // 4. Push to history
  conversationHistory.push({ role: "user", text });

  // 5. Show typing indicator
  showTyping();

  try {
    // 6. Call the backend API
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(-MAX_HISTORY),
      }),
    });

    hideTyping();

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const botReply = data.reply || "I'm here for you. Could you share a bit more? 💙";

    // 7. Push bot response to history
    conversationHistory.push({ role: "bot", text: botReply });

    // 8. Render bot bubble with emotion badge + follow-up
    appendBotMessage(botReply, emotion);

  } catch (error) {
    hideTyping();
    console.error("[EmoCare] API Error:", error);

    const errorMsg =
      error.message.includes("Failed to fetch")
        ? "I'm having trouble connecting right now. Please check your connection and try again. 🌐"
        : `Something went wrong: ${error.message}. Please try again. 🙏`;

    appendBotMessage(errorMsg, DEFAULT_EMOTION);
  } finally {
    isWaiting = false;
    updateSendButton();
    chatInput.focus();
  }
}

/* ═══════════════════════════════════════════════════
   13. INPUT HANDLING
═══════════════════════════════════════════════════ */

/** Auto-resize textarea based on content */
function autoResizeInput() {
  chatInput.style.height = "auto";
  const maxH = 120;
  const newH = Math.min(chatInput.scrollHeight, maxH);
  chatInput.style.height = `${newH}px`;
}

/** Enable/disable send button based on input content */
function updateSendButton() {
  const hasText = chatInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || isWaiting;
}

/** Handle keyboard: Enter sends, Shift+Enter newline */
function handleInputKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

/** Update character counter */
function handleInputEvent() {
  const len = chatInput.value.length;
  charCounter.textContent = `${len}/1000`;
  if (len > 900) {
    charCounter.style.color = "var(--danger)";
  } else {
    charCounter.style.color = "";
  }
  autoResizeInput();
  updateSendButton();
}

/* ═══════════════════════════════════════════════════
   14. SUGGESTION CHIPS
═══════════════════════════════════════════════════ */

/** Handle quick suggestion chip click */
function handleChipClick(event) {
  const chip = event.target.closest(".chip");
  if (!chip) return;

  const message = chip.dataset.message;
  if (!message) return;

  chatInput.value = message;
  autoResizeInput();
  updateSendButton();
  sendMessage();
}

/* ═══════════════════════════════════════════════════
   15. EMOJI PICKER
═══════════════════════════════════════════════════ */

/** Build emoji grid */
function buildEmojiGrid() {
  emojiGrid.innerHTML = "";
  EMOJI_LIST.forEach((emoji, i) => {
    const btn = document.createElement("button");
    btn.className = "emoji-item";
    btn.textContent = emoji;
    btn.setAttribute("aria-label", `Insert emoji ${emoji}`);
    btn.id = `emoji-${i}`;
    btn.addEventListener("click", () => {
      insertAtCursor(emoji);
      closeEmojiPanel();
    });
    emojiGrid.appendChild(btn);
  });
}

/** Insert text at current cursor position in textarea */
function insertAtCursor(text) {
  const start = chatInput.selectionStart;
  const end   = chatInput.selectionEnd;
  const value = chatInput.value;
  chatInput.value = value.slice(0, start) + text + value.slice(end);
  chatInput.selectionStart = chatInput.selectionEnd = start + text.length;
  chatInput.focus();
  handleInputEvent();
}

/** Toggle emoji panel open/closed */
function toggleEmojiPanel() {
  const isOpen = emojiPanel.classList.toggle("open");
  emojiPanel.setAttribute("aria-hidden", String(!isOpen));
}

/** Close emoji panel */
function closeEmojiPanel() {
  emojiPanel.classList.remove("open");
  emojiPanel.setAttribute("aria-hidden", "true");
}

/** Close emoji panel when clicking outside */
function handleOutsideClick(event) {
  if (
    emojiPanel.classList.contains("open") &&
    !emojiPanel.contains(event.target) &&
    event.target !== emojiBtn
  ) {
    closeEmojiPanel();
  }
}

/* ═══════════════════════════════════════════════════
   16. EVENT LISTENERS
═══════════════════════════════════════════════════ */

function attachEventListeners() {
  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Send button
  sendBtn.addEventListener("click", sendMessage);

  // Input events
  chatInput.addEventListener("input",   handleInputEvent);
  chatInput.addEventListener("keydown", handleInputKeydown);

  // Suggestion chips (event delegation)
  suggestionChips.addEventListener("click", handleChipClick);

  // Emoji picker
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEmojiPanel();
  });

  document.addEventListener("click", handleOutsideClick);

  // System dark mode change (live)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    // Only auto-switch if user hasn't set a manual preference
    if (!localStorage.getItem("emocare-theme")) {
      applyTheme(e.matches);
    }
  });

  // Keyboard: Escape closes emoji panel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeEmojiPanel();
  });
}

/* ═══════════════════════════════════════════════════
   17. INITIALISE
═══════════════════════════════════════════════════ */

function init() {
  initTheme();
  buildEmojiGrid();
  attachEventListeners();
  renderWelcomeMessage();

  // Apply default emotion badge
  updateEmotionBadge(DEFAULT_EMOTION);

  // Focus input after brief delay (avoids mobile keyboard pop on load)
  setTimeout(() => {
    if (window.innerWidth >= 768) {
      chatInput.focus();
    }
  }, 300);
}

// Boot when DOM is ready
document.addEventListener("DOMContentLoaded", init);
