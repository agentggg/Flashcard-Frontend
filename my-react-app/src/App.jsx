// src/App.jsx
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import axios from "axios";
import "./App.css";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";

// Prism languages (add more as needed)
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";

function detectLanguage(title, code) {
  const t = String(title || "").toLowerCase();
  const c = String(code || "");
  const cl = c.toLowerCase();

  // Allow explicit hint in title like: "[lang=js]" or "lang: python"
  const m1 = t.match(/\[\s*lang\s*=\s*([a-z0-9_+-]+)\s*\]/i);
  const m2 = t.match(/\blang\s*:\s*([a-z0-9_+-]+)/i);
  const hinted = (m1?.[1] || m2?.[1] || "").trim();
  if (hinted) return normalizeLang(hinted);

  // Support fenced code blocks: ```js\n...\n```
  const fence = c.match(/^```\s*([a-z0-9_+-]+)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fence?.[1]) return normalizeLang(fence[1]);

  // Heuristics
  if (/(^|\n)\s*def\s+\w+\s*\(|(^|\n)\s*class\s+\w+\s*[:(]|\bimport\s+\w+|\bfrom\s+\w+\s+import\b/.test(c)) return "python";
  if (/(^|\n)\s*(const|let|var)\s+\w+\s*=|\bfunction\s+\w+\s*\(|=>|\bconsole\.log\b|\brequire\(|\bmodule\.exports\b|\bexport\s+default\b/.test(c)) return "javascript";
  if (/(^|\n)\s*interface\s+\w+|\btype\s+\w+\s*=|:\s*(string|number|boolean)\b/.test(c)) return "typescript";
  if (/(^|\n)\s*<(!doctype|html|div|span|script|style)\b|<\w+[\s>]/.test(c)) return "markup";
  if (/\{\s*"[^"]+"\s*:/.test(c) && /\}\s*$/.test(c.trim())) return "json";
  if (/\b(select|insert|update|delete|from|where|join)\b/.test(cl)) return "sql"; // falls back to plaintext if not loaded
  if (/(^|\n)\s*(\$\s+)?(ls|cd|mkdir|rm|cp|mv|cat|grep|curl|wget)\b/.test(c)) return "bash";
  if (/^\s*\w+\s*:\s*.+/m.test(c) && /\n\s*\w+\s*:\s*.+/m.test(c)) return "yaml";

  // Also use course-ish keywords in the title when present
  if (t.includes("javascript") || t.includes("js")) return "javascript";
  if (t.includes("typescript") || t.includes("ts")) return "typescript";
  if (t.includes("html") || t.includes("markup")) return "markup";
  if (t.includes("css")) return "css";
  if (t.includes("json")) return "json";
  if (t.includes("bash") || t.includes("shell") || t.includes("terminal")) return "bash";
  if (t.includes("yaml") || t.includes("yml")) return "yaml";
  if (t.includes("python") || t.includes("py")) return "python";

  return "python"; // default
}

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

function stripFenceIfPresent(code) {
  const c = String(code || "");
  const fence = c.match(/^```\s*([a-z0-9_+-]+)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (!fence) return { lang: null, code: c };
  return { lang: fence[1] ? normalizeLang(fence[1]) : null, code: fence[2] };
}

function AutoFitCode({ code, language }) {
  const highlighted = useMemo(() => {
    const lang = normalizeLang(language);
    const grammar = Prism.languages[lang];
    if (!grammar) return escapeHtml(code);
    return Prism.highlight(code, grammar, lang);
  }, [code, language]);

  return (
    <pre
      className="code-autofit"
      style={{
        whiteSpace: "pre-wrap",     // ✅ wrap lines
        wordBreak: "break-word",    // ✅ break long tokens
        overflowX: "hidden",        // ❌ no horizontal scroll
        fontSize: "12px",           // ✅ mobile-safe
        lineHeight: "1.45",
        margin: 0
      }}
    >
      <code
        className={`language-${normalizeLang(language)}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderQuestionWithCode(text) {
  const parts = String(text).split("\n\n");
  if (parts.length < 2) return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;

  const title = parts[0];
  const rawCode = parts.slice(1).join("\n\n");

  const fenced = stripFenceIfPresent(rawCode);
  const language = fenced.lang || detectLanguage(title, fenced.code);

  return (
    <>
      <div style={{ whiteSpace: "pre-wrap" }}>{title}</div>
      <div className="codeblock-scroll">
        <AutoFitCode code={fenced.code} language={language} />
      </div>
    </>
  );
}
// Optional fallback data if backend fails / is empty
const fallbackFlashcards = [
    {
    "course":"python_coding_literacy",
    "question":"What is this code doing?\n\nnumbers = [1, 2, 3, 4, 5]\nresult = [n * 2 for n in numbers if n > 3]",
    "answer":"It creates a new list with values greater than 3 doubled.",
    "reasoning":"The list comprehension filters numbers greater than 3 and applies multiplication by 2 to each remaining element."
  },
    {
    "course":"python_coding_literacy",
    "question":"What is this code doing?\n\ndef clean(data):\n    return [x for x in data if x is not None]",
    "answer":"It removes None values from a list.",
    "reasoning":"The list comprehension iterates over the input data and keeps only elements that are not None."
  },
  {
    question: "What is a closure in JavaScript?",
    answer: "A closure is a function that remembers its outer variables.",
    reasoning:
      "A closure allows a function to access variables from its lexical scope even when it's called outside that scope. It's created whenever a function is defined inside another function and the inner function uses variables from the outer one."
  },
  {
    question: "What does HTTP stand for?",
    answer: "HyperText Transfer Protocol",
    reasoning:
      "HTTP is the foundation of data communication on the web. It defines how messages are formatted and transmitted, and how web servers and browsers should respond to various commands."
  },
  {
    question: "What is React?",
    answer: "A JavaScript library for building user interfaces.",
    reasoning:
      "React helps you build reusable UI components. It uses a virtual DOM and a declarative style so you can describe what the UI should look like for each state, and React handles efficiently updating the view."
  }
];

// 🔹 Simple course selector homepage
function CourseSelector({ onSelect }) {
  const courses = [
    { id: "bigo", label: "BigO Notation", filterId: "Computer Science" },

    { id: "python", label: "Python (Core)", filterId: "Coding" },
    { id: "javascript", label: "JavaScript", filterId: "Coding" },

    { id: "html_css", label: "HTML & CSS", filterId: "Frontend Development" },

    { id: "ict", label: "Trading ICT Strategies", filterId: "Trading Concept"},
    { id: "fvg", label: "Fair Value Gap", filterId: "Trading Concept" },
    { id: "ob", label: "Order Block", filterId: "Trading Concept" },
    { id: "mss", label: "Market Structure Shift", filterId: "Trading Concept" },
    { id: "PDARRAY", label: "Premium / Discount Array", filterId: "Trading Concept" },
    { id: "ICT-BB", label: "Breaker Block", filterId: "Trading Concept" },
    { id: "ICT-InverseFVG", label: "Inverse FVG", filterId: "Trading Concept" },
    { id: "ICT-Implied-FVG", label: "Implied FVG", filterId: "Trading Concept" },
    { id: "ICT-BPR", label: "Balanced Price Range", filterId: "Trading Concept" },
    { id: "ICT-Rejection-Block", label: "Rejection Block", filterId: "Trading Concept" },
    { id: "ICT-Vaccum-Gap", label: "Vacuum Gap", filterId: "Trading Concept" },
    { id: "ICT-Mitigration-Block", label: "Mitigation Block", filterId: "Trading Concept" },

    { id: "ros2", label: "ROS2", filterId: "Robotic" },
    { id: "raspberry_pi_motor_control", label: "Raspberry Pi Motor Control", filterId: "Robotic" },

    { id: "ml", label: "Machine Learning", filterId: "Computer Vision" },
    { id: "yolo", label: "YOLO", filterId: "Computer Vision" },
    { id: "opencv", label: "OpenCV", filterId: "Computer Vision" },
    { id: "computer_vision_core", label: "Computer Vision Core", filterId: "Computer Vision" },
    
    { id: "yolo_coding", label: "YOLO Coding", filterId: "Practical Coding" },
    { id: "ros2_coding", label: "ROS2 Coding", filterId: "Practical Coding" },
    { id: "advance_python_coding", label: "Advance Python Coding", filterId: "Practical Coding" },
    { id: "computer_vision_coding", label: "Computer Vision Coding", filterId: "Practical Coding" },

    // { id: "python_coding_literacy", label: "Easy Code Literacy", filterId: "Python Code Literacy" },
    { id: "beginner_python_coding_literacy", label: "Beginner Code Literacy", filterId: "Python Code Literacy" },
    { id: "advanced_python_coding_literacy", label: "Advanced Code Literacy", filterId: "Python Code Literacy" },
    { id: "intermediate_yolo_coding_literacy", label: "Advanced Code Literacy", filterId: "YOLO Code Literacy" },
    { id: "beginner_yolo_coding_literacy", label: "Beginner Code Literacy", filterId: "YOLO Code Literacy" },
    { id: "beginner_computer_vision_coding_literacy", label: "Beginner Code Literacy", filterId: "Computer Vision Code Literacy" },
    { id: "beginner_javascript_coding_literacy", label: "Beginner Code Literacy", filterId: "JavaScript Code Literacy" },

    
  ];

  // Group them a bit so it feels intentiona

const practicalCodingConcept = courses.filter((c) => c.filterId === "Practical Coding");
const codingCourse = courses.filter((c) => c.filterId === "Coding");
const frontendDevelopmentCourse = courses.filter((c) => c.filterId === "Frontend Development");
const ictConcept = courses.filter((c) => c.filterId === "Trading Concept");
const computerScienceConcept = courses.filter((c) => c.filterId === "Computer Science");
const computerVisionConcept = courses.filter((c) => c.filterId === "Computer Vision");
const roboticConcept = courses.filter((c) => c.filterId === "Robotic");
const pythonCodeLiteracy = courses.filter((c) => c.filterId === "Python Code Literacy");
const yoloCodeLiteracy = courses.filter((c) => c.filterId === "YOLO Code Literacy");
const computerVisionCodeLiteracy = courses.filter((c) => c.filterId === "Computer Vision Code Literacy");
const javascriptCodeLiteracy = courses.filter((c) => c.filterId === "JavaScript Code Literacy");


  const sections = [
    { title: "Coding", items: codingCourse },
    { title: "Frontend Development", items: frontendDevelopmentCourse },
    { title: "Trading · Concepts", items: ictConcept },
    { title: "Computer Science", items: computerScienceConcept },
    { title: "Computer Vision", items: computerVisionConcept },
    { title: "Robotic", items: roboticConcept },
    { title: "Hands On Coding Skills", items: practicalCodingConcept },
    { title: "Python Code Literacy", items: pythonCodeLiteracy },
    { title: "YOLO Code Literacy", items: yoloCodeLiteracy },
    { title: "Computer Vision Code Literacy", items: computerVisionCodeLiteracy },
    { title: "JavaScript Code Literacy", items: javascriptCodeLiteracy },
  ];

  const [openSections, setOpenSections] = useState(() =>
    sections.reduce((acc, section) => {
      acc[section.title] = false; // start collapsed
      return acc;
    }, {})
  );

  

  const toggleSection = (title) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <div className="course-selector">
      <div className="course-selector-header">
        <p className="course-eyebrow">Pick your lane</p>
        <h2 className="course-heading">
          What do you want to <span>drill</span> today?
        </h2>
        <p className="course-tagline">
          Tap a track to load a focused flashcard session. You can always come
          back and switch lanes.
        </p>
      </div>

      <div className="course-selector-panel">
        {sections.map((section) => {
          const isOpen = openSections[section.title];

          return (
            <section key={section.title} className="course-section">
              <button
                type="button"
                className="course-section-header"
                onClick={() => toggleSection(section.title)}
              >
                <span className="course-section-pill" />
                <h3>{section.title}</h3>
                <span className="course-section-chevron">
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <ul className="course-list">
                  {section.items.map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        className="course-row"
                        onClick={() => onSelect(course.id)}
                      >
                        <div className="course-row-left">
                          <div className="course-row-icon">
                            {course.id.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="course-row-text">
                            <span className="course-row-label">
                              {course.label}
                            </span>
                          </div>
                        </div>

                        <div className="course-row-cta">
                          <span>Start</span>
                          <span className="course-row-arrow">↪</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Flashcard({ card, index, total, onNext, onPrev }) {
  const [view, setView] = useState("question"); // "question" | "answer" | "explain"

  const isBack = view !== "question";

  const handleShowAnswer = () => setView("answer");
  const handleShowExplain = () => setView("explain");
  const handleReset = () => setView("question");

  return (
    <div className="flashcard-wrapper animate-in">
      <div className="flashcard-meta">
        <span className="chip chip-soft">
          Card {index + 1} of {total}
        </span>
        {view === "question" && <span className="chip chip-accent">Question</span>}
        {view === "answer" && <span className="chip chip-accent">Answer</span>}
        {view === "explain" && <span className="chip chip-accent">Explanation</span>}
      </div>

      <div className="flashcard-scene">
        <div className={`flashcard ${isBack ? "is-flipped" : ""}`}>
          {/* FRONT: QUESTION */}
          <div className="flashcard-face flashcard-front">
            <div className="card-gradient-overlay" />
            <div className="flashcard-content">
              <p className="flashcard-label">Tap “Answer” to flip</p>
              <div className="flashcard-question">
                {renderQuestionWithCode(card.question)}
              </div>
            </div>
          </div>

          {/* BACK: ANSWER / EXPLANATION */}
          <div className="flashcard-face flashcard-back">
            <div className="card-gradient-overlay card-gradient-overlay-back" />
            <div className="flashcard-content">
              <p className="flashcard-label">
                {view === "answer" ? "Answer" : "Explanation"}
              </p>
              <h2 className="flashcard-answer">{card.answer}</h2>

              {view === "explain" && (
                <p className="flashcard-reasoning">{card.reasoning}</p>
              )}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(card.question)}ict`}
                style={{ color: '#ffc107' }} // Bootstrap warning color
                target="_blank"
              >
                Learn more
              </a>
              {/* <button className="btn" onClick={()=>{window.open(`https://www.google.com/search?q=${encodeURIComponent(card.question)}`, '_blank');}} type="button">
                Learn more...
              </button> */}

              {view === "answer" && (
                <p className="flashcard-hint">
                  Want more context? Tap <strong>Explain</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flashcard-controls">
        <button className="btn btn-secondary" onClick={onPrev} type="button">
          ← Previous
        </button>

        <div className="flashcard-actions">
          <button
            className="btn btn-ghost"
            onClick={handleReset}
            disabled={view === "question"}
            type="button"
          >
            Reset
          </button>

          <button className="btn" onClick={handleShowAnswer} type="button">
            Answer
          </button>

          <button className="btn btn-outline" onClick={handleShowExplain} type="button">
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

function App() {
  const [cards, setCards] = useState(fallbackFlashcards);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false); // start false; show homepage first
  const [error, setError] = useState("");
  const [course, setCourse] = useState(""); // <- selected course
  const [isLeavingCourse, setIsLeavingCourse] = useState(false); // 🔥 for fade-out
  // When user picks a course on the homepage
  const handleSelectCourse = (courseId) => {
    setCourse(courseId);
    setCurrent(0);
    setError("");
    setIsLeavingCourse(false);  
  };

  // Fetch cards whenever course changes
  useEffect(() => {
    if (!course) return; // no course selected yet → don't fetch

    const controller = new AbortController();

    async function fetchCards() {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get("https://ict-agentofgod.pythonanywhere.com/get_flashcard", {
          params: { course },          
          signal: controller.signal
        }); 
        // const res = await axios.get("http://localhost:8000/get_flashcard", {
        //   params: { course },          // 👈 backend sees ?course=python (or javascript, etc.)
        //   signal: controller.signal
        // });

        const data = res.data;

        if (Array.isArray(data) && data.length) {
          setCards(data);
        } else {
          console.warn("No cards returned for course:", course);
          setCards(fallbackFlashcards);
        }

        setCurrent(0);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error(err);
          setError("Failed to load flashcards. Using demo deck.");
          setCards(fallbackFlashcards);
          setCurrent(0);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
    return () => controller.abort();
  }, [course]);

  const goNext = () => {
    setCurrent((prev) =>
      cards.length ? (prev + 1) % cards.length : 0
    );
  };

  const goPrev = () => {
    setCurrent((prev) =>
      cards.length ? (prev === 0 ? cards.length - 1 : prev - 1) : 0
    );
  };

  const currentCard = cards[current];

  return (
    <div className="app-root">
      {/* Logo top-right */}
      <div className="app-logo">
        <div className="app-logo-mark">T&F</div>
        <span className="app-logo-text">Tech & FAITH</span>
      </div>

      <div className="app-bg-blur" />
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Flashcard Lab</h1>
          <p className="app-subtitle">
            {course
              ? <>Course: <span>{course}</span>{error && <> · <span style={{ color: "#ff6bcb" }}>{error}</span></>}</>
              : <>Tech in the hands of the <span>righteous</span> people.</>}
          </p>
        </header>

<main className="app-main">
  {/* If no course selected yet → show homepage selector */}
  {!course && <CourseSelector onSelect={handleSelectCourse} />}

  {/* After course selected → show loading or flashcard deck */}
  {course && (
    loading ? (
      <div className="flashcard-wrapper animate-in">
        <div className="flashcard-meta">
          <span className="chip chip-soft">Loading {course}…</span>
        </div>
        <div className="flashcard-content">
          <p className="flashcard-label">Preparing your deck</p>
          <h2 className="flashcard-question">
            Fetching flashcards for{" "}
            <span style={{ color: "#ff6bcb" }}>{course}</span>…
          </h2>
        </div>
      </div>
    ) : (
      <div
        className={`flashcard-page ${
          isLeavingCourse ? "flashcard-page-exit" : "flashcard-page-enter"
        }`}
      >
        <button
          type="button"
          className="btn-home"
          onClick={() => {
            // 🔥 trigger exit animation
            setIsLeavingCourse(true);

            // wait for CSS animation to finish, then actually go home
            setTimeout(() => {
              setCourse("");
              setCurrent(0);
              setError("");
              setIsLeavingCourse(false);
            }, 380); // match CSS duration
          }}
        >
          ← Back to Courses
        </button>

        <Flashcard
          key={current}
          card={currentCard}
          index={current}
          total={cards.length}
          onNext={goNext}
          onPrev={goPrev}
        />
      </div>
    )
  )}
</main>
      </div>
    </div>
  );
}

export default App;
