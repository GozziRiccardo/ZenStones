import * as React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import RegisterPage from './pages/Register';
import LoginPage from './pages/Login';
import VerifySentPage from './pages/VerifySent';
import VerifyCompletePage from './pages/VerifyComplete';
import NicknamePage from './pages/Nickname';
import PlayPage from './pages/Play';
import MatchPage from './pages/Match';
import './styles.css';

export default function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/verify-sent" element={<VerifySentPage />} />
        <Route path="/auth/verify-complete" element={<VerifyCompletePage />} />
        <Route path="/nickname" element={<NicknamePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
