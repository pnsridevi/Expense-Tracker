const STRIP_PATTERNS = [
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[CARD_NUMBER]",
  },

  {
    pattern: /\b\d{8,18}\b/g,
    replacement: "[ACCOUNT_NUMBER]",
  },

  {
    pattern: /(?:\+91|0)?[6-9]\d{9}\b/g,
    replacement: "[PHONE]",
  },

  {
    pattern:
      /[\w.\-+]+@(?:okicici|okhdfcbank|okaxis|oksbi|ybl|upi|paytm|apl|ikwik|waicici|wahdfc|idfcbank|indus|aubank|rbl|kotak|axisbank|hdfcbank|sbi|icici|federal|sc|hsbc|citi|yes|pnb|bob|boi|union|canara|idbi|bandhan|airtel|jio|freecharge|mobikwik|phonepe|gpay|amazonpay|amazonpe)\b/gi,
    replacement: "[UPI_ID]",
  },

  {
    pattern: /\b[\w.\-+]{3,}@[\w]{3,}\b/g,
    replacement: "[UPI_ID]",
  },

  {
    pattern: /\bDear\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/g,
    replacement: "Dear [NAME]",
  },

  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
];

/**
 * @param {string} text - Raw email body text
 * @returns {string} - Cleaned text safe to send to Haiku
 */
export function stripPII(text) {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  for (const { pattern, replacement } of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned;
}
