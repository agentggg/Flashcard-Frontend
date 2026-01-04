// src/features/flashcardLab/components/LiveCodeCard.jsx
import { useMemo, useState } from "react";
import Prism from "../utils/prism";
import {
  escapeHtml,
  normalizeForChecks,
  normalizeLang,
  computeGrade,
  pct,
  kindLabel,
  impactLabel,
} from "../utils/grading";

export default function LiveCodeCard({ card, index, total, onNext, onPrev }) {
  const [code, setCode] = useState("");
  const [report, setReport] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const expectations = Array.isArray(card?.expectations) ? card.expectations : [];
  const language = normalizeLang(card?.language || "python");

  const highlighted = useMemo(() => {
    const grammar = Prism.languages[language];
    if (!grammar) return escapeHtml(code);
    return Prism.highlight(code || "", grammar, language);
  }, [code, language]);

  const run = () => {
    const codeNorm = normalizeForChecks(code);
    setAttempt((a) => a + 1);
    setReport(computeGrade(expectations, codeNorm));
  };

  const canProceed = report?.verdict === "Strong Pass" || report?.verdict === "Pass";

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const insert = "  ";
      const next = code.slice(0, start) + insert + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insert.length;
      });
    }
  };

  const onEditorScroll = (e) => {
    const ta = e.currentTarget;
    const surface = ta.parentElement;
    const pre = surface?.querySelector("pre");
    if (pre) {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
  };

  return (
    <div className="flashcard-wrapper animate-in">
      <div className="flashcard-meta">
        <span className="chip chip-soft">Card {index + 1} of {total}</span>
        <span className="chip chip-accent">Live Code</span>
        {attempt > 0 && <span className="chip chip-soft">Attempt {attempt}</span>}
      </div>

      <div className="flashcard-content" style={{ gap: 12 }}>
        <p className="flashcard-label">{card?.title || "Code Challenge"}</p>
        <div style={{ whiteSpace: "pre-wrap", opacity: 0.92 }}>{card?.prompt}</div>

        <div className="assess-row">
          <div className="assess-badges">
            <span className="assess-badge">Language: {language}</span>
          </div>
        </div>

        <div className="code-editor">
          <div className="code-editor-toolbar">
            <div className="code-editor-toolbar-left">
              <span className="assess-badge">Tip: press TAB to indent</span>
            </div>
            <div className="code-editor-toolbar-right">
              <button className="btn btn-outline" type="button" onClick={() => setCode("")} disabled={!code}>
                Clear
              </button>
            </div>
          </div>

          <div className="code-editor-surface">
            <pre className="code-editor-highlight" aria-hidden="true">
              <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted + "\n" }} />
            </pre>

            <textarea
              className="code-editor-textarea"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={onEditorScroll}
              placeholder="Type your code here…"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={run}>Assess</button>
          <button className="btn btn-outline" type="button" onClick={() => setReport(null)} disabled={!report}>
            Clear Report
          </button>
        </div>

        {report && (
          <div className="report-panel">
            <div className="assess-row" style={{ marginBottom: 10 }}>
              <div>
                <strong>{report.verdict}</strong> · Score {pct(report.percent)} · Confidence {pct(report.confidence)}
              </div>
              <span className="assess-score-pill">
                {Math.round(report.earned * 100) / 100} / {Math.round(report.totalPossible * 100) / 100}
              </span>
            </div>

            <div className="assess-report">
              {report.checks.map((c, i) => {
                const label = kindLabel(c.kind);
                const impact = impactLabel(c.weight);

                return (
                  <div
                    key={i}
                    className="report-item"
                    style={{ background: c.passed ? "rgba(80,255,140,.08)" : "rgba(255,80,80,.08)" }}
                  >
                    <div className="assess-row">
                      <strong>{c.passed ? "✔" : "✘"} {c.description}</strong>
                      <div className="assess-badges">
                        <span className="assess-badge">{label}</span>
                        <span className="assess-badge">Impact: {impact}</span>
                      </div>
                    </div>

                    {!c.passed && c.hint && (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.92 }}>
                        <strong>Hint:</strong> {c.hint}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!canProceed && (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
                Pass required checks to unlock Next.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flashcard-controls">
        <button className="btn btn-secondary" onClick={onPrev} type="button">← Previous</button>

        <div className="flashcard-actions">
          <button className="btn btn-outline" onClick={onNext} type="button">Skip →</button>
          <button className="btn" onClick={onNext} type="button" disabled={!canProceed}>
            Next (unlocked on pass) →
          </button>
        </div>

        <button className="btn btn-secondary" onClick={onNext} type="button">Next →</button>
      </div>
    </div>
  );
}