// src/App.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// Optional fallback data if backend fails / is empty
const fallbackFlashcards = [
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
    { id: "python", label: "Python (Core)" },
    { id: "javascript", label: "JavaScript" },
    { id: "ict", label: "ICT Trading" },
    { id: "bible", label: "Bible / Devotional" }
  ];

  return (
    <div className="course-selector">
      <p className="course-tagline">
        Choose a <span>course</span> to start your flashcard session.
      </p>
      <div className="course-grid">
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            className="course-card"
            onClick={() => onSelect(course.id)}
          >
            <div className="course-pill">{course.id}</div>
            <h2 className="course-title">{course.label}</h2>
            <p className="course-subtitle">
              Tap to load questions for <strong>{course.id}</strong>.
            </p>
          </button>
        ))}
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
              <h2 className="flashcard-question">{card.question}</h2>
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
          params: { course },          // 👈 backend sees ?course=python (or javascript, etc.)
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
