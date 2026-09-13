import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dataSourceResolver } from '../data/source-resolver.js';
import { extensionBridge } from '../data/extension-bridge.js';

const API_ORIGIN = process.env['API_ORIGIN'] || 'http://localhost:9000';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('正在处理知乎登录认证…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tokenParam = searchParams.get('token');
        const uidParam = searchParams.get('uid');
        const nameParam = searchParams.get('name');
        const codeParam = searchParams.get('code');

        let userSession: { uid: string; name: string; token: string } | null = null;

        if (tokenParam && uidParam) {
          userSession = {
            uid: uidParam,
            name: nameParam || '知乎用户',
            token: tokenParam,
          };
        } else if (codeParam) {
          // Exchange code via backend
          setStatus('正在与服务器换取登录凭据…');
          const res = await fetch(`${API_ORIGIN}/auth/zhihu/callback?code=${encodeURIComponent(codeParam)}`);
          if (!res.ok) {
            throw new Error(`认证换取失败: HTTP ${res.status}`);
          }
          const data = await res.json();
          userSession = {
            uid: data.uid,
            name: data.name || '知乎用户',
            token: data.token,
          };
        } else {
          throw new Error('未获取到有效认证信息');
        }

        if (userSession) {
          dataSourceResolver.saveUserSession(userSession);
          setStatus('正在配对浏览器插件…');

          try {
            await extensionBridge.pairUser(userSession.token, userSession.uid);
          } catch (pairErr) {
            console.warn('Extension pairing skipped during callback:', pairErr);
          }

          setStatus('登录成功，正在跳转…');
          setTimeout(() => {
            navigate('/');
          }, 800);
        }
      } catch (err: any) {
        setError(err.message || '登录处理失败');
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        {error ? (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>❌</div>
            <h3 style={{ color: '#b91c1c', margin: '0 0 8px 0' }}>认证失败</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>{error}</p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: '16px',
                padding: '8px 16px',
                background: '#0066ff',
                color: '#ffffff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '13px',
              }}
            >
              重新登录
            </a>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
            <h3 style={{ color: '#0f172a', margin: '0 0 8px 0' }}>{status}</h3>
            <p style={{ color: '#94a3b8', fontSize: '12px' }}>请稍候…</p>
          </div>
        )}
      </div>
    </div>
  );
};
