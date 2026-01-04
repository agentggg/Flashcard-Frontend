// src/features/flashcardLab/FlashcardLabRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import QaWritingLab from "./QaWritingLab";

export default function QaWritingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<QaWritingLab />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}