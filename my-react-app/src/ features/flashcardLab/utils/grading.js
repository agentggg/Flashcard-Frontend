// src/features/flashcardLab/utils/grading.js
export function normalizeLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "js") return "javascript";
  if (l === "ts") return "typescript";
  if (l === "py") return "python";
  if (l === "html") return "markup";
  if (l === "sh" || l === "shell") return "bash";
  if (l === "yml") return "yaml";
  return l;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeTest(pattern, text) {
  try {
    return pattern.test(text);
  } catch {
    return false;
  }
}

export function normalizeForChecks(code) {
  return String(code || "").replace(/\r\n/g, "\n");
}

export function computeGrade(expectations, codeNorm) {
  const checks = [];
  let totalPossible = 0;
  let earned = 0;
  let forbiddenHits = 0;
  let requiredMisses = 0;

  for (const rule of expectations) {
    const weight = typeof rule.weight === "number" ? rule.weight : 1;
    const matched = safeTest(rule.pattern, codeNorm);
    const passed = rule.forbidden ? !matched : !!matched;

    const kind = rule.forbidden
      ? "forbidden"
      : rule.required
      ? "required"
      : rule.optional
      ? "optional"
      : "neutral";

    checks.push({ ...rule, weight, matched, passed, kind });

    if (rule.forbidden) {
      totalPossible += weight;
      if (!matched) earned += weight;
      else forbiddenHits += 1;
    } else if (rule.required) {
      totalPossible += weight;
      if (matched) earned += weight;
      else requiredMisses += 1;
    } else if (rule.optional) {
      if (matched) earned += weight * 0.35;
    }
  }

  const percent = totalPossible > 0 ? Math.max(0, Math.min(1, earned / totalPossible)) : 0;

  let confidence = percent;
  if (forbiddenHits) confidence -= Math.min(0.25, forbiddenHits * 0.08);
  if (requiredMisses) confidence -= Math.min(0.25, requiredMisses * 0.05);
  confidence = Math.max(0, Math.min(1, confidence));

  const passedAllRequired = requiredMisses === 0;

  const verdict =
    percent >= 0.92 && forbiddenHits === 0 && passedAllRequired
      ? "Strong Pass"
      : percent >= 0.75 && forbiddenHits <= 1
      ? "Pass"
      : percent >= 0.55
      ? "Partial"
      : "Needs Work";

  return { percent, confidence, verdict, checks, totalPossible, earned };
}

export function pct(x) {
  return `${Math.round(x * 100)}%`;
}

export function kindLabel(kind) {
  if (kind === "forbidden") return "Forbidden";
  if (kind === "required") return "Required";
  if (kind === "optional") return "Optional";
  return "Check";
}

export function impactLabel(weight) {
  const w = typeof weight === "number" ? weight : 1;
  if (w >= 1.3) return "High";
  if (w >= 1.15) return "Medium";
  return "Low";
}