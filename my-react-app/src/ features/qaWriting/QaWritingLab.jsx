// src/features/qaWriting/QaWritingLab.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./QaWritingLab.css";

function normalizeLevel(level) {
  const l = String(level || "").toLowerCase().trim();
  if (["awesome", "excellent", "great", "a+", "perfect"].includes(l)) return "awesome";
  if (["high", "good", "strong"].includes(l)) return "high";
  if (["medium", "mid", "ok", "fair"].includes(l)) return "medium";
  if (["low", "weak"].includes(l)) return "low";
  if (["fail", "failed", "poor"].includes(l)) return "fail";
  return l || "medium";
}

function levelMeta(level) {
  const l = normalizeLevel(level);
  const map = {
    awesome: { label: "Awesome", tone: "success" },
    high: { label: "High", tone: "success" },
    medium: { label: "Medium", tone: "warn" },
    low: { label: "Low", tone: "danger" },
    fail: { label: "Fail", tone: "danger" },
  };
  return map[l] || { label: String(level || "Medium"), tone: "warn" };
}

function buildGoogleUrl(query) {
  const q = encodeURIComponent(String(query || "").trim());
  return `https://www.google.com/search?q=${q}`;
}

function getQuestionId(q) {
  return q?.id ?? q?._id ?? q?.pk ?? null;
}

function toneClass(tone) {
  if (tone === "success") return "qa-pill qa-pill--success";
  if (tone === "danger") return "qa-pill qa-pill--danger";
  return "qa-pill qa-pill--warn";
}

export default function QaWritingLab({
  GET_QUESTIONS_ENDPOINT = "http://localhost:8000/get_ai_questions",
  SUBMIT_ANSWER_ENDPOINT = "http://localhost:8000/grade_ai_answers",
}) {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);

  const [loadingQ, setLoadingQ] = useState(true);
  const [errorQ, setErrorQ] = useState("");

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // response: { grade_check: [...], answer: "..." }
  const [resultPack, setResultPack] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const current = questions[idx] || null;
  const currentId = getQuestionId(current);

  const resultsRef = useRef(null);

  const googleLink = useMemo(() => {
    if (!current?.question) return "#";
    return buildGoogleUrl(current.question);
  }, [current?.question]);

  // Fetch questions
  useEffect(() => {
    let alive = true;

    async function fetchQuestions() {
      try {
        setLoadingQ(true);
        setErrorQ("");

        const res = await axios.get(GET_QUESTIONS_ENDPOINT);
        const data = res?.data;

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.data)
          ? data.data
          : [];

        if (!arr.length) throw new Error("No questions returned from backend.");

        if (!alive) return;
        setQuestions(arr);
        setIdx(0);
      } catch (e) {
        if (!alive) return;
        setErrorQ(e?.message || "Failed to load questions.");
      } finally {
        if (!alive) return;
        setLoadingQ(false);
      }
    }

    fetchQuestions();
    return () => {
      alive = false;
    };
  }, [GET_QUESTIONS_ENDPOINT]);

  // When results arrive, scroll them into view (this makes it “feel” like it popped up)
  useEffect(() => {
    if (!resultPack) return;
    // small delay so the DOM renders first
    const t = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [resultPack]);

  const resetResult = () => {
    setResultPack(null);
    setSubmitError("");
  };

  const nextQuestion = () => {
    if (!questions.length) return;
    setIdx((p) => (p + 1) % questions.length);
    setAnswer("");
    resetResult();
  };

  const prevQuestion = () => {
    if (!questions.length) return;
    setIdx((p) => (p === 0 ? questions.length - 1 : p - 1));
    setAnswer("");
    resetResult();
  };

  const submit = async () => {
    if (!currentId) {
      setSubmitError("No question ID found (expected id or _id).");
      return;
    }
    if (!answer.trim()) {
      setSubmitError("Type your answer first.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setResultPack(null);

      const payload = { id: currentId, answer: answer.trim() };
      const res = await axios.post(SUBMIT_ANSWER_ENDPOINT, payload);
      const data = res?.data;

      // STRICT validation so it cannot “silently not render”
      const grade_check_ok = Array.isArray(data?.grade_check);
      const answer_ok = typeof data?.answer === "string";

      if (!grade_check_ok && !answer_ok) {
        throw new Error("Backend response missing grade_check and answer.");
      }

      // Force a predictable structure
      setResultPack({
        grade_check: grade_check_ok ? data.grade_check : [],
        answer: answer_ok ? data.answer : "",
        raw: data, // keep raw for debugging if needed
      });
    } catch (e) {
      setSubmitError(e?.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const gradeChecks = Array.isArray(resultPack?.grade_check) ? resultPack.grade_check : [];
  const formalAnswer = typeof resultPack?.answer === "string" ? resultPack.answer : "";

  return (
    <div className="qa-wrap">
      <header className="qa-header">
        <div className="qa-titleBlock">
          <div className="qa-title">Q/A Writing Lab</div>
          <div className="qa-subtitle">Write an answer, submit it, and review feedback + the formal answer.</div>
        </div>

        <div className="qa-progress">
          {questions.length ? (
            <span className="qa-muted">
              Question <strong>{idx + 1}</strong> / {questions.length}
            </span>
          ) : null}
        </div>
      </header>

      <section className="qa-card">
        {loadingQ ? (
          <div className="qa-muted">Loading questions…</div>
        ) : errorQ ? (
          <div className="qa-alert qa-alert--danger">{errorQ}</div>
        ) : current ? (
          <>
            <div className="qa-row qa-row--space">
              <div className="qa-kicker">Prompt</div>

              <div className="qa-chipRow">
                <span className="qa-chip">id: {String(currentId ?? "—")}</span>
                <span className="qa-chip">pass_score: {current.pass_score ?? "—"}</span>
                <span className="qa-chip">require_keypoints: {current.require_keypoints ?? "—"}</span>
              </div>
            </div>

            <div className="qa-question">{current.question}</div>

            <div className="qa-field">
              <div className="qa-kicker">Your answer</div>
              <textarea
                className="qa-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here…"
                rows={6}
              />
            </div>

            {submitError ? <div className="qa-alert qa-alert--danger">{submitError}</div> : null}

            <div className="qa-actions">
              <button className="qa-btn qa-btn--primary" type="button" onClick={submit} disabled={submitting}>
                {submitting ? "Sending…" : "Send answer"}
              </button>

              <button
                className="qa-btn qa-btn--ghost"
                type="button"
                onClick={() => {
                  setAnswer("");
                  resetResult();
                }}
                disabled={submitting}
              >
                Clear
              </button>

              <div className="qa-actionsSpacer" />

              <button className="qa-btn qa-btn--ghost" type="button" onClick={prevQuestion} disabled={submitting}>
                ← Prev
              </button>
              <button className="qa-btn qa-btn--ghost" type="button" onClick={nextQuestion} disabled={submitting}>
                Next →
              </button>
            </div>
          </>
        ) : (
          <div className="qa-muted">No question selected.</div>
        )}
      </section>

      {/* RESULTS */}
      {(formalAnswer || gradeChecks.length > 0) && (
        <section className="qa-card qa-card--results" ref={resultsRef}>
          <div className="qa-row qa-row--space">
            <div className="qa-kicker">Results</div>
            <div className="qa-muted">Shows immediately after you click Send.</div>
          </div>

          {formalAnswer ? (
            <div className="qa-panel">
              <div className="qa-panelTitle">Formal answer</div>
              <div className="qa-panelBody">{formalAnswer}</div>
            </div>
          ) : null}

          {gradeChecks.length > 0 ? (
            <div className="qa-breakdown">
              <div className="qa-panelTitle">Feedback breakdown</div>

              <div className="qa-grid">
                {gradeChecks.map((r, i) => {
                  const meta = levelMeta(r?.level);
                  return (
                    <div className="qa-item" key={`${r?.model || "model"}-${i}`}>
                      <div className="qa-itemTop">
                        <div className="qa-itemTitle">{r?.model || "Model"}</div>
                        <span className={toneClass(meta.tone)}>
                          {meta.label} ({normalizeLevel(r?.level)})
                        </span>
                      </div>
                      <div className="qa-itemMsg">{r?.message || "No message provided."}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="qa-divider" />

          <div className="qa-learn">
            <div className="qa-panelTitle">Learn more</div>
            <div className="qa-muted">
              Read 1–2 definitions, then rewrite your answer in your own words while keeping the same core meaning.
            </div>

            <a className="qa-btn qa-btn--link" href={googleLink} target="_blank" rel="noreferrer">
              Google this question →
            </a>
          </div>

          {/* Debug (keep for now; remove later) */}
          <details className="qa-debug">
            <summary>Debug response</summary>
            <pre>{JSON.stringify(resultPack?.raw ?? resultPack, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}