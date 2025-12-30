// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "./App.css";

// Prism languages
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";

/**
 * EXPECTED BACKEND FORMAT:
 * Flashcards:
 *   { course, question, answer, reasoning }
 *
 * Live-code cards (typing editor):
 *   { type: "code-regex", course, language, title, prompt, expectations:[{description, pattern, required|optional|forbidden, weight, hint}] }
 *
 * If your backend currently only returns flashcards, Live Code will still work using local demo typing cards.
 */

// -------------------------
// Helpers
// -------------------------
function normalizeLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "js") return "javascript";
  if (l === "ts") return "typescript";
  if (l === "py") return "python";
  if (l === "html") return "markup";
  if (l === "sh" || l === "shell") return "bash";
  if (l === "yml") return "yaml";
  return l;
}

function escapeHtml(str) {
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

function normalizeForChecks(code) {
  return String(code || "").replace(/\r\n/g, "\n");
}

function computeGrade(expectations, codeNorm) {
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

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function kindLabel(kind) {
  if (kind === "forbidden") return "Forbidden";
  if (kind === "required") return "Required";
  if (kind === "optional") return "Optional";
  return "Check";
}

function impactLabel(weight) {
  const w = typeof weight === "number" ? weight : 1;
  if (w >= 1.3) return "High";
  if (w >= 1.15) return "Medium";
  return "Low";
}

function renderQuestionWithCode(text) {
  const input = String(text || "");
  const fenceRe = /```([a-z0-9_+-]+)?\s*\n([\s\S]*?)\n```/gi;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = fenceRe.exec(input)) !== null) {
    const [full, rawLang, code] = match;
    const start = match.index;
    const end = start + full.length;

    const before = input.slice(lastIndex, start);
    if (before) {
      nodes.push(
        <div key={`t-${blockIndex}-${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
          {before}
        </div>
      );
    }

    const lang = normalizeLang(rawLang || "python");
    const grammar = Prism.languages[lang];
    const highlighted = grammar ? Prism.highlight(code, grammar, lang) : escapeHtml(code);

    nodes.push(
      <div key={`c-${blockIndex}-${start}`} className="codeblock-scroll">
        <pre className="code-autofit">
          <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    );

    lastIndex = end;
    blockIndex += 1;
  }

  const after = input.slice(lastIndex);
  if (after) {
    nodes.push(
      <div key={`t-after-${lastIndex}`} style={{ whiteSpace: "pre-wrap" }}>
        {after}
      </div>
    );
  }

  return nodes.length ? <>{nodes}</> : <span style={{ whiteSpace: "pre-wrap" }}>{input}</span>;
}

// -------------------------
// Modal (dynamic course list)
// -------------------------
function CoursePickerModal({ open, title, subtitle, courses, onSelect, onClose }) {
  if (!open) return null;
  const list = Array.isArray(courses) ? courses : [];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <div className="modal-title">{title || "Select a course"}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {list.length === 0 ? (
            <div className="modal-empty">No courses found from backend data.</div>
          ) : (
            <div className="modal-grid">
              {list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="modal-course"
                  onClick={() => onSelect(c.id)}
                >
                  <div className="modal-course-title">{c.label}</div>
                  <div className="modal-course-meta">{c.meta}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------
// Live-code card (typing editor)
// -------------------------
function LiveCodeCard({ card, index, total, onNext, onPrev }) {
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
        <span className="chip chip-soft">
          Card {index + 1} of {total}
        </span>
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
              <code
                className={`language-${language}`}
                dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
              />
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
          <button className="btn" type="button" onClick={run}>
            Assess
          </button>
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
                    style={{
                      background: c.passed ? "rgba(80,255,140,.08)" : "rgba(255,80,80,.08)",
                    }}
                  >
                    <div className="assess-row">
                      <strong>
                        {c.passed ? "✔" : "✘"} {c.description}
                      </strong>
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
        <button className="btn btn-secondary" onClick={onPrev} type="button">
          ← Previous
        </button>

        <div className="flashcard-actions">
          <button className="btn btn-outline" onClick={onNext} type="button">
            Skip →
          </button>
          <button className="btn" onClick={onNext} type="button" disabled={!canProceed}>
            Next (unlocked on pass) →
          </button>
        </div>

        <button className="btn btn-secondary" onClick={onNext} type="button">
          Next →
        </button>
      </div>
    </div>
  );
}

// -------------------------
// Flashcard card
// -------------------------
function Flashcard({ card, index, total, onNext, onPrev }) {
  const [view, setView] = useState("question"); // question | answer | explain
  const isBack = view !== "question";

  return (
    <div className="flashcard-wrapper animate-in">
      <div className="flashcard-meta">
        <span className="chip chip-soft">
          Card {index + 1} of {total}
        </span>
        <span className="chip chip-accent">
          {view === "question" ? "Question" : view === "answer" ? "Answer" : "Explanation"}
        </span>
      </div>

      <div className="flashcard-scene">
        <div className={`flashcard ${isBack ? "is-flipped" : ""}`}>
          <div className="flashcard-face flashcard-front">
            <div className="card-gradient-overlay" />
            <div className="flashcard-content">
              <p className="flashcard-label">Tap “Answer” to flip</p>
              <div className="flashcard-question">{renderQuestionWithCode(card?.question)}</div>
            </div>
          </div>

          <div className="flashcard-face flashcard-back">
            <div className="card-gradient-overlay card-gradient-overlay-back" />
            <div className="flashcard-content">
              <p className="flashcard-label">{view === "answer" ? "Answer" : "Explanation"}</p>
              <h2 className="flashcard-answer">{card?.answer}</h2>
              {view === "explain" && <p className="flashcard-reasoning">{card?.reasoning}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="flashcard-controls">
        <button className="btn btn-secondary" onClick={onPrev} type="button">
          ← Previous
        </button>

        <div className="flashcard-actions">
          <button className="btn btn-ghost" onClick={() => setView("question")} disabled={view === "question"} type="button">
            Reset
          </button>
          <button className="btn" onClick={() => setView("answer")} type="button">
            Answer
          </button>
          <button className="btn btn-outline" onClick={() => setView("explain")} type="button">
            Explain
          </button>
        </div>

        <button className="btn btn-secondary" onClick={onNext} type="button">
          Next →
        </button>
      </div>
    </div>
  );
}

// -------------------------
// Local demo typing cards (so Live Code works immediately)
// -------------------------
const localTypingCards = [
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

const FALLBACK_FLASHCARDS = [
  ...localTypingCards,
  {
    course: "javascript_easy",
    question: "What does this output?\n\n```javascript\nconsole.log(2 + '2');\n```",
    answer: "“22”",
    reasoning: "When adding a number to a string, JavaScript coerces to string concatenation.",
  },
];

function App() {
  const ENDPOINT = "https://ict-agentofgod.pythonanywhere.com/get_flashcard";

  // allCards = everything from backend (plus local typing demos)
  const [allCards, setAllCards] = useState(FALLBACK_FLASHCARDS);

  // filtered deck (based on selected course + mode)
  const [cards, setCards] = useState(FALLBACK_FLASHCARDS);

  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // selection state
  const [course, setCourse] = useState("");
  const [mode, setMode] = useState(""); // "flash" | "live"

  // modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("flash"); // which button opened it

  // Fetch everything once from backend
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get(ENDPOINT, { signal: controller.signal });
        const data = res.data;

        if (Array.isArray(data) && data.length) {
          // merge in local typing cards so Live Code is always available
          const merged = [...localTypingCards, ...data];
          setAllCards(merged);
        } else {
          setAllCards(FALLBACK_FLASHCARDS);
        }
      } catch (e) {
        setError("Backend not reachable. Using local demo data.");
        setAllCards(FALLBACK_FLASHCARDS);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    return () => controller.abort();
  }, []);

  // Build course options dynamically FROM BACKEND DATA (not hard-coded)
  const flashCourseOptions = useMemo(() => {
    const map = new Map();
    for (const c of allCards || []) {
      if (!c?.course) continue;
      if (c?.type === "code-regex") continue; // flash mode excludes typing cards
      map.set(c.course, (map.get(c.course) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: id, meta: `${count} cards` }));
  }, [allCards]);

  const liveCourseOptions = useMemo(() => {
    const map = new Map();
    for (const c of allCards || []) {
      if (!c?.course) continue;
      if (c?.type !== "code-regex") continue; // live mode ONLY typing cards
      map.set(c.course, (map.get(c.course) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: id, meta: `${count} challenges` }));
  }, [allCards]);

  // Apply filter when course/mode changes
  useEffect(() => {
    if (!course || !mode) {
      setCards(allCards);
      return;
    }

    const filtered = (allCards || []).filter((c) => {
      if (c?.course !== course) return false;
      if (mode === "live") return c?.type === "code-regex";
      return c?.type !== "code-regex";
    });

    setCards(filtered.length ? filtered : FALLBACK_FLASHCARDS);
    setCurrent(0);
  }, [course, mode, allCards]);

  const openPicker = (m) => {
    setPickerMode(m === "live" ? "live" : "flash");
    setPickerOpen(true);
  };

  const startSession = (pickedCourse) => {
    setCourse(pickedCourse);
    setMode(pickerMode);
    setPickerOpen(false);
    setCurrent(0);
  };

  const goHome = () => {
    setCourse("");
    setMode("");
    setCurrent(0);
  };

  const goNext = () => setCurrent((p) => (cards.length ? (p + 1) % cards.length : 0));
  const goPrev = () => setCurrent((p) => (cards.length ? (p === 0 ? cards.length - 1 : p - 1) : 0));

  const currentCard = cards[current];

  return (
    <div className="app-root">
      <CoursePickerModal
        open={pickerOpen}
        title={pickerMode === "live" ? "Live Code" : "Flashcards"}
        subtitle={
          pickerMode === "live"
            ? "Select a course to open the typing editor challenges."
            : "Select a course to drill flashcards."
        }
        courses={pickerMode === "live" ? liveCourseOptions : flashCourseOptions}
        onSelect={startSession}
        onClose={() => setPickerOpen(false)}
      />

      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Flashcard Lab</h1>
          <p className="app-subtitle">
            {course ? (
              <>
                Course: <span>{course}</span> · Mode: <span>{mode === "live" ? "Live Code" : "Flashcards"}</span>
              </>
            ) : (
              <>Pick a mode and course from backend data.</>
            )}
            {error && (
              <>
                {" "}
                · <span style={{ color: "#ff6bcb" }}>{error}</span>
              </>
            )}
          </p>
        </header>

        <main className="app-main">
          {!course && (
            <div className="launcher">
              <div className="launcher-card">
                <div className="launcher-title">Choose a session</div>
                <div className="launcher-subtitle">
                  Live Code gives you a typing editor. Flashcards drills Q/A.
                </div>

                {loading ? (
                  <div style={{ marginTop: 12, opacity: 0.9 }}>Loading from backend…</div>
                ) : (
                  <div className="launcher-actions">
                    <button type="button" className="btn" onClick={() => openPicker("flash")}>
                      Start Flashcards
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => openPicker("live")}>
                      Live Code
                    </button>
                  </div>
                )}

                {!loading && (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                    Course list is computed from backend response (no hard-coded list).
                  </div>
                )}
              </div>
            </div>
          )}

          {course && (
            <div className="flashcard-page flashcard-page-enter">
              <button type="button" className="btn-home" onClick={goHome}>
                ← Back Home
              </button>

              {currentCard?.type === "code-regex" ? (
                <LiveCodeCard
                  key={current}
                  card={currentCard}
                  index={current}
                  total={cards.length}
                  onNext={goNext}
                  onPrev={goPrev}
                />
              ) : (
                <Flashcard
                  key={current}
                  card={currentCard}
                  index={current}
                  total={cards.length}
                  onNext={goNext}
                  onPrev={goPrev}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;