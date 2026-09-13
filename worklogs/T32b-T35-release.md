# T32b & T35 发布打包与检查工作日志

## 1. 任务完成概况
- **T32b (扩展发布包与静态发布产物)**：
  - 编写 `scripts/package-release.ts` 打包流水线。
  - 通过 esbuild 编译 content script 与 background worker，保证 `manifest.json` 位于 zip 根目录。
  - 自动输出插件压缩包至 `web/public/downloads/zhihu-explore-extension.zip`。
  - 自动计算 SHA-256 校验和并生成 `release-manifest.json`。
  - 完成 Web 生产构建，将产物集成至 `dist/web/`。
- **T35 (发布检查与安全扫描)**：
  - 编写 `scripts/release-check.ts` 检查套件。
  - 校验 `release-manifest.json` 与发布 zip 的 SHA-256 哈希一致性。
  - 校验前端入口文件 `dist/web/index.html` 完整性。
  - 对打包资产执行敏感信息（API Key、密钥、Token）安全正则扫描，确保无私钥与泄露凭证。

## 2. 检查输出
- 插件打包体积：约 166.8 KB。
- 安全扫描结果：全部通过，无泄露敏感信息。
- 自动化执行命令：
  - `npm run package:release`
  - `npm run release:check`
