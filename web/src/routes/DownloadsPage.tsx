import React from 'react';

export const DownloadsPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '40px 24px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '36px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px' }}>🧩</span>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              知乎兴趣探索 · Chrome 插件安装
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              Manifest V3 原生架构 · 本地离线支持 · 专栏划词智能追问
            </p>
          </div>
        </div>

        {/* Download Action Card */}
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: '#166534', fontSize: '15px' }}>
              zhihu-explore-extension-v0.0.1.zip
            </div>
            <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
              包含全部 Content Script、Background Service Worker 及预编译资产
            </div>
          </div>

          <a
            href="/downloads/zhihu-explore-extension.zip"
            download
            style={{
              background: '#16a34a',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⬇️ 下载插件 ZIP
          </a>
        </div>

        {/* Step-by-step Installation Instructions */}
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>
          安装步骤指南（开发者模式一键加载）
        </h2>

        <ol style={{ paddingLeft: '20px', color: '#334155', lineHeight: 1.8, fontSize: '14px' }}>
          <li>
            <strong>下载并解压</strong>：点击上方绿色按钮下载 <code>.zip</code> 压缩包，并解压到任意本地目录。
          </li>
          <li>
            <strong>打开扩展管理</strong>：在 Chrome 浏览器地址栏中输入 <code>chrome://extensions</code> 并回车。
          </li>
          <li>
            <strong>开启开发者模式</strong>：在页面右上角，将 <strong>“开发者模式” (Developer mode)</strong> 开关拨至开启状态。
          </li>
          <li>
            <strong>加载已解压的扩展程序</strong>：点击页面左上角的 <strong>“加载已解压的扩展程序” (Load unpacked)</strong> 按钮。
          </li>
          <li>
            <strong>选择插件目录</strong>：选择刚才解压出来的文件夹（包含 <code>manifest.json</code> 的根目录）。
          </li>
          <li>
            <strong>开始体验</strong>：打开任意知乎专栏文章（例如 <code>zhuanlan.zhihu.com/p/...</code>），用鼠标划选感兴趣的文字，即可在右侧展开探索追问树！
          </li>
        </ol>

        <div
          style={{
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <a
            href="/"
            style={{
              color: '#0284c7',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            ← 返回知识树首页
          </a>

          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            版本号 v0.0.1 · 纯静态安全打包
          </span>
        </div>
      </div>
    </div>
  );
};
