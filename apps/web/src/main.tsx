import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles/tokens.css';
import './styles/app.css';
import './styles/sam.css';
import './styles/cats.css';
import { getSocket } from './net/client';
import { HomePage } from './features/lobby/HomePage';
import { GamePage } from './features/table/GamePage';
import { NotFound } from './features/lobby/NotFound';
import { ConnectionBanner, Toasts } from './ui/ui';

getSocket();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConnectionBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameId" element={<GamePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  </StrictMode>,
);
