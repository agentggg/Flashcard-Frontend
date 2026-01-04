// src/features/flashcardLab/data/localTypingCards.js
export const localTypingCards = [
  {
    type: "code-regex",
    course: "javascript_easy",
    language: "javascript",
    title: "JS Easy: Write add(a,b)",
    prompt:
      "Write JavaScript code that defines a function `add(a, b)` and returns the sum.\n" +
      "Constraints:\n- Must return the result\n- Must use parameters a and b",
    expectations: [
      {
        description: "Defines add function",
        pattern: /\bfunction\s+add\s*\(\s*a\s*,\s*b\s*\)\s*\{|\bconst\s+add\s*=\s*\(\s*a\s*,\s*b\s*\)\s*=>/i,
        required: true,
        weight: 1.3,
        hint: "Use `function add(a,b){ ... }` or `const add = (a,b)=>{ ... }`",
      },
      {
        description: "Returns a + b",
        pattern: /\breturn\s+a\s*\+\s*b\b/i,
        required: true,
        weight: 1.3,
        hint: "Return the sum: `return a + b;`",
      },
      {
        description: "Avoids console-only solution",
        pattern: /\bconsole\.log\b/i,
        forbidden: true,
        weight: 1.1,
        hint: "Return the value; do not only log it.",
      },
    ],
  },
];

export const FALLBACK_FLASHCARDS = [
  ...localTypingCards,
  {
    course: "javascript_easy",
    question: "What does this output?\n\n```javascript\nconsole.log(2 + '2');\n```",
    answer: "“22”",
    reasoning: "When adding a number to a string, JavaScript coerces to string concatenation.",
  },
];