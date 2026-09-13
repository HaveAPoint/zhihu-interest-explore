import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './index.css';

import { HomePage } from './routes/HomePage.js';
import { LoginPage } from './routes/LoginPage.js';
import { AuthCallback } from './routes/AuthCallback.js';
import { DownloadsPage } from './routes/DownloadsPage.js';

function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '24px',
      }}
    >
      <h1 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 12px 0' }}>404</h1>
      <p style={{ color: '#64748b', marginBottom: '20px' }}>您访问的页面不存在。</p>
      <Link
        to="/"
        style={{
          padding: '8px 16px',
          background: '#0066ff',
          color: '#ffffff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '14px',
        }}
      >
        返回首页
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/d/:disciplineId" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}
