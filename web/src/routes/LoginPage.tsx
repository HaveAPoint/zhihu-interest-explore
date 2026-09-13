import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataSourceResolver } from '../data/source-resolver.js';
import { extensionBridge } from '../data/extension-bridge.js';

const API_ORIGIN =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.['VITE_API_ORIGIN']) ||
  (typeof process !== 'undefined' && process.env ? process.env['API_ORIGIN'] : '') ||
  'http://localhost:9000';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick dev login for local testing
  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // In dev mode, generate a test user session
      const mockUser = {
        uid: `user_${Date.now()}`,
        name: '知乎探索测试用户',
        token: `mock_jwt_token_${Date.now()}`,
      };

      dataSourceResolver.saveUserSession(mockUser);

      // Attempt extension pairing
      try {
        await extensionBridge.pairUser(mockUser.token, mockUser.uid);
      } catch (pairErr) {
        console.warn('Extension pairing skipped (not installed or in dev):', pairErr);
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // Zhihu OAuth Login Redirect
  const handleZhihuOAuthLogin = () => {
    // Redirect to Fastify server's OAuth entry point
    window.location.href = `${API_ORIGIN}/auth/zhihu/login`;
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>💡</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
            登录知乎兴趣探索
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            登录知乎账号，自动将浏览器插件中的专栏阅读追问树同步到云端知识图谱。
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
              border: '1px solid #fecaca',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleZhihuOAuthLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#0066ff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            知乎账号一键登录
          </button>

          <button
            onClick={handleDevLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            本地开发者快捷登录
          </button>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              color: '#64748b',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            ← 返回首页
          </a>
        </div>
      </div>
    </div>
  );
};
