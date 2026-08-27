# R21 PWA Cloudflare Pages 手工上传指南

## 上传包

`oneone-pwa-r21-cloudflare-pages.zip`

ZIP 解压后 `index.html` 直接位于根目录，不要再套一层 `build-pwa-r21/` 目录。

## 手工上传

1. 在 Cloudflare Pages 创建或选择目标 Pages 项目。
2. 选择手工上传静态资产。
3. 上传 `oneone-pwa-r21-cloudflare-pages.zip`，或上传其解压后的全部内容。
4. 保留 `_headers` 文件，使首页、Service Worker 和 manifest 使用 no-cache。
5. 发布后使用 Pages 分配的 `pages.dev` HTTPS 地址访问。
6. 首次访问后可按浏览器支持添加到主屏幕。

## 包检查结果

- ZIP 条目：146。
- 文件数小于 1000：通过。
- 最大单文件解压大小：2,473,730 bytes，小于 25 MiB：通过。
- `index.html` 位于 ZIP 根目录：通过。
- 未嵌套 `build-pwa-r21` 目录：通过。
- PWA `start_url` 与 `scope`：`./`。
- Service Worker 缓存名：`oneone-production-r21`。

## R21 运行配置

包内仅包含公开运行字段：CloudBase EnvId、函数名称、公开 API Base URL 和非敏感功能配置。未包含密码、Token、Cookie 或 Secret。

## 本轮边界

本轮未登录 Cloudflare、未请求 Cloudflare API Token、未自动上传、未上传 CloudBase 生产根目录、未切换首页、未部署函数、未迁移数据、未执行真实业务写入，未调用 AI、推送或账单。
