// src/features/flashcardLab/FlashcardLab.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import '../../App.css'
import CoursePickerModal from "./components/CoursePickerModal";
import Flashcard from "./components/Flashcard";
import LiveCodeCard from "./components/LiveCodeCard";
import TypedAnswerCard from "./components/TypedAnswerCard";

import { localTypingCards, FALLBACK_FLASHCARDS } from "./data/localTypingCards";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function formatCourseName(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeFlashcards(data) {
  // data can be: [] OR {results: []} OR {data: []}
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return (arr || [])
    .map((x) => {
      const course = x?.course ?? x?.Course ?? x?.course_name ?? x?.courseName ?? "";
      // Only treat as live-code if it truly has expectations
      const isLive = Array.isArray(x?.expectations) && x.expectations.length > 0;
      const type = isLive ? "code-regex" : "flash";
      return { ...x, course, type };
    })
    .filter((x) => !!x?.course);
}

function normalizeAiCards(data) {
  // Expect array of objects like:
  // { id, question, official_answer, require_keypoints, pass_score, course }
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return (arr || [])
    .map((x) => {
      const course = x?.course ?? x?.Course ?? x?.course_name ?? x?.courseName ?? "AI";
      return {
        ...x,
        course,
        type: "ai",
      };
    })
    .filter((x) => !!x?.question);
}

function buildCourseOptions(cards, mode) {
  // mode: "flash" | "live" | "ai"
  const map = new Map();

  for (const c of cards || []) {
    if (!c?.course) continue;

    const t = c?.type;
    const isLive = t === "code-regex";
    const isAi = t === "ai";

    if (mode === "live" && !isLive) continue;
    if (mode === "ai" && !isAi) continue;
    if (mode === "flash" && (isLive || isAi)) continue;

    map.set(c.course, (map.get(c.course) || 0) + 1);
  }

  const labelSuffix = mode === "live" ? "challenges" : mode === "ai" ? "questions" : "cards";

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, count]) => ({
      id,
      label: formatCourseName(id),
      meta: `${count} ${labelSuffix}`,
    }));
}

function isAxiosCanceled(e) {
  return (
    e?.name === "CanceledError" ||
    e?.code === "ERR_CANCELED" ||
    (typeof axios.isCancel === "function" && axios.isCancel(e) === true)
  );
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

export default function FlashcardLab() {
  // Backend endpoints
  // const FLASH_ENDPOINT = "https://ict-agentofgod.pythonanywhere.com/get_flashcard";
  // const AI_ENDPOINT = "https://ict-agentofgod.pythonanywhere.com/ai_questions";
  // const GRADE_ENDPOINT = "https://ict-agentofgod.pythonanywhere.com/grade_answer";

  const FLASH_ENDPOINT = "http://localhost:8000/get_flashcard";
  const AI_ENDPOINT = "http://localhost:8000/get_ai_questions";
  const GRADE_ENDPOINT = "http://localhost:8000/grade_ai_answers";

  // Everything the app can render (flash + live + ai)
  const [allCards, setAllCards] = useState(() => {
    // Always keep local typing cards available on first paint
    return [...localTypingCards, ...FALLBACK_FLASHCARDS];
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Session state
  const [course, setCourse] = useState("");
  const [mode, setMode] = useState(""); // "flash" | "live" | "ai"
  const [current, setCurrent] = useState(0);

  // Course picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("flash");

  // ----------------------------------------------------------
  // Fetch content (flash + ai) and merge with local typing
  // ----------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch flashcards + AI cards in parallel.
        // If AI endpoint doesn't exist yet, we will gracefully ignore it.
        const [flashRes, aiRes] = await Promise.allSettled([
          axios.get(FLASH_ENDPOINT, { signal: controller.signal }),
          axios.get(AI_ENDPOINT, { signal: controller.signal }),
        ]);

        let flashNormalized = [];
        if (flashRes.status === "fulfilled") {
          flashNormalized = normalizeFlashcards(flashRes.value?.data);
        }

        let aiNormalized = [];
        if (aiRes.status === "fulfilled") {
          aiNormalized = normalizeAiCards(aiRes.value?.data);
        }

        // If AI endpoint failed, don't break the page.
        // Only show an error if flash endpoint failed too.
        if (flashRes.status === "rejected") {
          const err = flashRes.reason;
          if (!isAxiosCanceled(err)) {
            console.error("[FlashcardLab] flash fetch failed:", err);
            setError("Backend not reachable. Using local demo data.");
          }
          // keep local typing + fallback flashcards
          setAllCards([...localTypingCards, ...FALLBACK_FLASHCARDS]);
          return;
        }

        // Merge: local typing (live) + backend flash + backend ai
        const merged = [...localTypingCards, ...flashNormalized, ...aiNormalized];
        setAllCards(merged.length ? merged : [...localTypingCards, ...FALLBACK_FLASHCARDS]);
        setError("");
      } catch (e) {
        if (isAxiosCanceled(e)) return;
        console.error("[FlashcardLab] fetch failed:", e);
        setError("Backend not reachable. Using local demo data.");
        setAllCards([...localTypingCards, ...FALLBACK_FLASHCARDS]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  // ----------------------------------------------------------
  // Derived: course lists per mode
  // ----------------------------------------------------------
  const flashCourseOptions = useMemo(() => buildCourseOptions(allCards, "flash"), [allCards]);
  const liveCourseOptions = useMemo(() => buildCourseOptions(allCards, "live"), [allCards]);
  const aiCourseOptions = useMemo(() => buildCourseOptions(allCards, "ai"), [allCards]);

  // ----------------------------------------------------------
  // Derived: deck for the current session
  // ----------------------------------------------------------
  const deck = useMemo(() => {
    if (!course || !mode) return [];

    return (allCards || []).filter((c) => {
      if ((c?.course || "") !== course) return false;

      if (mode === "live") return c?.type === "code-regex";
      if (mode === "ai") return c?.type === "ai";

      // flash
      return c?.type !== "code-regex" && c?.type !== "ai";
    });
  }, [allCards, course, mode]);

  useEffect(() => {
    // Reset index when session changes
    setCurrent(0);
  }, [course, mode]);

  const currentCard = deck?.length ? deck[current % deck.length] : null;

  // Navigation
  const goNext = () => setCurrent((p) => (deck.length ? (p + 1) % deck.length : 0));
  const goPrev = () => setCurrent((p) => (deck.length ? (p === 0 ? deck.length - 1 : p - 1) : 0));

  // Picker
  const openPicker = (m) => {
    const nextMode = m === "live" ? "live" : m === "ai" ? "ai" : "flash";
    setPickerMode(nextMode);
    setPickerOpen(true);
  };

  const startSession = (pickedCourse) => {
    const pickedId =
      typeof pickedCourse === "string"
        ? pickedCourse
        : pickedCourse?.id || pickedCourse?.course || pickedCourse?.value || "";

    if (!pickedId) return;

    setCourse(pickedId);
    setMode(pickerMode);
    setPickerOpen(false);
    setCurrent(0);
  };

  const goHome = () => {
    setCourse("");
    setMode("");
    setCurrent(0);
  };

  const sessionTitle = mode === "live" ? "Live Code" : mode === "ai" ? "AI Cards" : "Flashcards";
  const courseLabel = course ? formatCourseName(course) : "";

  const hasLive = liveCourseOptions.length > 0;
  const hasFlash = flashCourseOptions.length > 0;
  const hasAi = aiCourseOptions.length > 0;

  return (
    <div className="app-root">
      <CoursePickerModal
        open={pickerOpen}
        title={pickerMode === "live" ? "Live Code" : pickerMode === "ai" ? "AI Cards" : "Flashcards"}
        subtitle={
          pickerMode === "live"
            ? "Select a course to open typing editor challenges."
            : pickerMode === "ai"
            ? "Select a course to answer questions and get AI grading."
            : "Select a course to drill flashcards."
        }
        courses={
          pickerMode === "live"
            ? liveCourseOptions
            : pickerMode === "ai"
            ? aiCourseOptions
            : flashCourseOptions
        }
        onSelect={startSession}
        onClose={() => setPickerOpen(false)}
      />

      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Flashcard Lab</h1>
          <p className="app-subtitle">
            {course ? (
              <>
                Course: <span>{courseLabel}</span> · Mode: <span>{sessionTitle}</span>
              </>
            ) : (
              <>Pick a mode and course.</>
            )}
            {error && (
              <>
                {" "}· <span style={{ color: "#ff6bcb" }}>{error}</span>
              </>
            )}
          </p>
        </header>

        <main className="app-main">
          {!course ? (
            <div className="launcher">
              <div className="launcher-card">
                <div className="launcher-title">Choose a session</div>
                <div className="launcher-subtitle">
                  Flashcards drills Q/A. Live Code gives typing challenges. AI Cards grades your written answers.
                </div>

                {loading ? (
                  <div style={{ marginTop: 12, opacity: 0.9 }}>Loading from backend…</div>
                ) : (
                  <div className="launcher-actions" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <button type="button" className="btn" onClick={() => openPicker("flash")} disabled={!hasFlash}>
                      Flashcards
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => openPicker("live")} disabled={!hasLive}>
                      Live Code
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => openPicker("ai")} disabled={!hasAi}>
                      AI Cards
                    </button>
                  </div>
                )}

                {!loading && (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                    Courses are computed from available data (backend + local typing challenges).
                  </div>
                )}

                {!loading && !hasAi && (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    AI Cards will appear once your backend exposes <code>/ai_questions</code>.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flashcard-page flashcard-page-enter">
              <button type="button" className="btn-home" onClick={goHome}>
                ← Back Home
              </button>

              {!currentCard ? (
                <div style={{ marginTop: 18, opacity: 0.9 }}>
                  No items found for this course/mode. Go back and pick another course.
                </div>
              ) : currentCard?.type === "code-regex" ? (
                <LiveCodeCard
                  key={`${mode}-${course}-${current}`}
                  card={currentCard}
                  index={current}
                  total={deck.length}
                  onNext={goNext}
                  onPrev={goPrev}
                />
              ) : mode === "ai" || currentCard?.type === "ai" ? (
                <TypedAnswerCard
                  key={`${mode}-${course}-${current}`}
                  card={currentCard}
                  index={current}
                  total={deck.length}
                  onNext={goNext}
                  onPrev={goPrev}
                  gradeAnswerEndpoint={GRADE_ENDPOINT}
                />
              ) : (
                <Flashcard
                  key={`${mode}-${course}-${current}`}
                  card={currentCard}
                  index={current}
                  total={deck.length}
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