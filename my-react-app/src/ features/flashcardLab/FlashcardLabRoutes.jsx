// src/features/flashcardLab/FlashcardLabRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import FlashcardLab from "./FlashcardLab";

export default function FlashcardLabRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FlashcardLab />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}