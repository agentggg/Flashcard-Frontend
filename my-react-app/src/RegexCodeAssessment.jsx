import { useMemo, useState } from "react";

/**
 * RegexConceptAssessment (Frontend-only)
 * - Grades "code answers" by regex concept checks.
 * - Works for any language (python/bash/js/etc.) because it's string analysis.
 * - Provides weighted scoring, partial credit, forbidden anti-pattern penalties, and hints.
 */

function normalizeForChecks(code) {
  const raw = String(code || "");
  // Keep original for display, but also have a normalized version for checks:
  // - normalize line endings
  // - collapse crazy spacing only for some heuristics
  const norm = raw.replace(/\r\n/g, "\n");
  return { raw, norm };
}

function safeTest(pattern, text) {
  try {
    return pattern.test(text);
  } catch {
    return false;
  }
}

function computeGrade(expectations, codeNorm) {
  const checks = [];
  let totalPossible = 0;
  let earned = 0;

  let forbiddenHits = 0;
  let requiredMisses = 0;

  // Support:
  // - required: true
  // - forbidden: true
  // - optional: true
  // - groupId: "msg_type" (one-of)
  // - weight: number
  //
  // A "group" passes if ANY rule in that group passes.
  // Group rules should usually be required.
  const groups = new Map(); // groupId -> { rules: [], weight, required }

  for (const rule of expectations) {
    const weight = typeof rule.weight === "number" ? rule.weight : 1;

    if (rule.groupId) {
      if (!groups.has(rule.groupId)) {
        groups.set(rule.groupId, {
          groupId: rule.groupId,
          title: rule.groupTitle || "Alternative requirement",
          rules: [],
          weight: rule.groupWeight ?? weight,
          required: Boolean(rule.required),
          optional: Boolean(rule.optional),
        });
      }
      groups.get(rule.groupId).rules.push({ ...rule, weight });
      continue;
    }

    const matched = safeTest(rule.pattern, codeNorm);
    const passed = rule.forbidden ? !matched : !!matched;

    const result = {
      ...rule,
      matched,
      passed,
      weight,
      kind: rule.forbidden ? "forbidden" : rule.required ? "required" : rule.optional ? "optional" : "neutral",
    };

    checks.push(result);

    // scoring
    if (rule.forbidden) {
      totalPossible += weight; // treat as "avoidance" requirement
      if (!matched) earned += weight;
      else forbiddenHits += 1;
    } else if (rule.required) {
      totalPossible += weight;
      if (matched) earned += weight;
      else requiredMisses += 1;
    } else if (rule.optional) {
      // optional = bonus points (doesn't increase totalPossible)
      if (matched) earned += weight * 0.35; // bonus factor
    } else {
      // neutral rules: ignore in scoring
    }
  }

  // Evaluate groups (one-of logic)
  for (const g of groups.values()) {
    const anyMatched = g.rules.some((r) => safeTest(r.pattern, codeNorm));
    const passed = g.required ? anyMatched : g.optional ? anyMatched : anyMatched;

    const groupResult = {
      id: g.groupId,
      description: g.title,
      kind: g.required ? "required" : g.optional ? "optional" : "neutral",
      weight: typeof g.weight === "number" ? g.weight : 1,
      matched: anyMatched,
      passed: g.required ? anyMatched : g.optional ? anyMatched : anyMatched,
      group: true,
      children: g.rules.map((r) => ({
        description: r.description,
        matched: safeTest(r.pattern, codeNorm),
      })),
      hint: g.rules.find((r) => r.hint)?.hint,
    };

    checks.push(groupResult);

    if (g.required) {
      totalPossible += groupResult.weight;
      if (anyMatched) earned += groupResult.weight;
      else requiredMisses += 1;
    } else if (g.optional) {
      if (anyMatched) earned += groupResult.weight * 0.35;
    }
  }

  // Clamp and normalize
  const percent = totalPossible > 0 ? Math.max(0, Math.min(1, earned / totalPossible)) : 0;

  // Confidence heuristic:
  // - start at percent
  // - reduce for forbidden hits and required misses
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

  return {
    percent,
    confidence,
    verdict,
    checks,
    totalPossible,
    earned,
    forbiddenHits,
    requiredMisses,
  };
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

export default function RegexConceptAssessment({ card, index, total, onNext, onPrev }) {
  const [code, setCode] = useState("");
  const [report, setReport] = useState(null);

  const expectations = Array.isArray(card?.expectations) ? card.expectations : [];

  const { norm } = useMemo(() => normalizeForChecks(code), [code]);

  const run = () => {
    const r = computeGrade(expectations, norm);
    setReport(r);
  };

  const missingHints = useMemo(() => {
    if (!report) return [];
    return report.checks
      .filter((c) => (c.kind === "required" || c.kind === "forbidden") && !c.passed && c.hint)
      .map((c) => c.hint);
  }, [report]);

  const canProceed = report?.verdict === "Strong Pass" || report?.verdict === "Pass";

  return (
    <div className="flashcard-wrapper animate-in">
      <div className="flashcard-meta">
        <span className="chip chip-soft">
          Card {index + 1} of {total}
        </span>
        <span className="chip chip-accent">Code · Concept Check</span>
      </div>

      <div className="flashcard-content" style={{ gap: 12 }}>
        <p className="flashcard-label">{card?.title || "Code Question"}</p>

        <div style={{ whiteSpace: "pre-wrap", opacity: 0.92 }}>{card?.prompt}</div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Language: <strong>{card?.language || "any"}</strong>
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type your code answer here…"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 260,
            borderRadius: 14,
            padding: 14,
            background: "rgba(0,0,0,.35)",
            border: "1px solid rgba(255,255,255,.14)",
            color: "white",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.5,
            outline: "none",
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={run}>
            Assess
          </button>
          <button className="btn btn-outline" type="button" onClick={() => setReport(null)}>
            Clear Report
          </button>
        </div>

        {report && (
          <div
            style={{
              marginTop: 6,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <strong>{report.verdict}</strong> · Score {pct(report.percent)} · Confidence {pct(report.confidence)}
              </div>
              <span className="chip chip-soft">
                {Math.round(report.earned * 100) / 100} / {Math.round(report.totalPossible * 100) / 100}
              </span>
            </div>

            {missingHints.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,180,80,.08)",
                }}
              >
                <strong>Hints (conceptual):</strong>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {missingHints.map((h, i) => (
                    <li key={i} style={{ marginBottom: 6, opacity: 0.95 }}>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {report.checks.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: c.passed ? "rgba(80,255,140,.08)" : "rgba(255,80,80,.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>
                      {c.passed ? "✔" : "✘"} {c.description}
                    </strong>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>
                      {c.group ? "one-of" : c.kind} · w={c.weight}
                    </span>
                  </div>

                  {c.group && Array.isArray(c.children) && (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                      {c.children.map((ch, idx) => (
                        <div key={idx} style={{ opacity: ch.matched ? 1 : 0.6 }}>
                          {ch.matched ? "• matched:" : "• option:"} {ch.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flashcard-controls">
        <button className="btn btn-secondary" onClick={onPrev} type="button">
          ← Previous
        </button>

        <div className="flashcard-actions">
          <button className="btn btn-outline" onClick={onNext} type="button">
            Skip →
          </button>
          <button className="btn" onClick={onNext} type="button" disabled={!canProceed}>
            Next (unlock on pass) →
          </button>
        </div>

        <button className="btn btn-secondary" onClick={onNext} type="button">
          Next →
        </button>
      </div>
    </div>
  );
}