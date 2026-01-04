// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import FlashcardLabRoutes from "./ features/flashcardLab/FlashcardLabRoutes";
import QaWritingLab from "./ features/qaWriting/QaWritingLab";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Feature module owns its own sub-routes */}
        <Route path="/flashcards/*" element={<FlashcardLabRoutes />} />
        <Route path="/qaWritting/*" element={<QaWritingLab />} />

        {/* Default route */}
        <Route path="/" element={<Navigate to="/flashcards" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/flashcards" replace />} />
      </Routes>
    </BrowserRouter>
  );
}