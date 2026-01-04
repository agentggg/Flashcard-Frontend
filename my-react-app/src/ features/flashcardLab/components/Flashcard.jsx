// src/features/flashcardLab/components/Flashcard.jsx
import { useState } from "react";
import Prism from "../utils/prism";
import { escapeHtml, normalizeLang } from "../utils/grading";

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

export default function Flashcard({ card, index, total, onNext, onPrev }) {
  const [view, setView] = useState("question"); // question | answer | explain
  const isBack = view !== "question";

  return (
    <div className="flashcard-wrapper animate-in">
      <div className="flashcard-meta">
        <span className="chip chip-soft">Card {index + 1} of {total}</span>
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
        <button className="btn btn-secondary" onClick={onPrev} type="button">← Previous</button>

        <div className="flashcard-actions">
          <button className="btn btn-ghost" onClick={() => setView("question")} disabled={view === "question"} type="button">
            Reset
          </button>
          <button className="btn" onClick={() => setView("answer")} type="button">Answer</button>
          <button className="btn btn-outline" onClick={() => setView("explain")} type="button">Explain</button>
        </div>

        <button className="btn btn-secondary" onClick={onNext} type="button">Next →</button>
      </div>
    </div>
  );
}