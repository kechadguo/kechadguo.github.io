/**
 * OneOne成长日记 — Service Worker
 * 策略：版本化静态资源精确缓存 + Network First（HTML）+ API 绕过
 */
// 正式构建规则：任何静态资源变更都必须生成新的唯一 CACHE_NAME，禁止复用旧版本名称。
const CACHE_NAME = 'oneone-production-r23-hotfix-release-0c7eea01c352';
const STATIC_ASSETS = ['./','./manifest.json','./css/v3-runtime.css?v=r23-hotfix','./js/theme-v3.js?v=r23-hotfix','./js/config.js?v=r23-hotfix','./js/production-runtime-config.js?v=r23-hotfix','./js/v3-contract.js?v=r23-hotfix','./js/message-queue.js?v=r23-hotfix','./js/data/vaccine-schedule.js?v=r23-hotfix','./js/data/growth-standard.js?v=r23-hotfix','./js/data/region-data.js?v=r23-hotfix','./js/data/milestone-standard.js?v=r23-hotfix','./js/data/badges-data.js?v=r23-hotfix','./js/data/nursing-standard.js?v=r23-hotfix','./js/data/exercise-plan.js?v=r23-hotfix','./js/data/food-plan.js?v=r23-hotfix','./js/data/knowledge-parenting.js?v=r23-hotfix','./js/data/early-edu-courses.js?v=r23-hotfix','./js/utils.js?v=r23-hotfix','./js/auth.js?v=r23-hotfix','./js/api.js?v=r23-hotfix','./js/breast-feeding.js?v=r23-hotfix','./js/feeding-time-chart.js?v=r23-hotfix','./js/voice.js?v=r23-hotfix','./js/pages/dashboard.js?v=r23-hotfix','./js/pages/quick-record.js?v=r23-hotfix','./js/pages/analytics-page.js?v=r23-hotfix','./js/pages/modules-page.js?v=r23-hotfix','./js/pages/parenting.js?v=r23-hotfix','./js/pages/milestone-page.js?v=r23-hotfix','./js/pages/report-page.js?v=r23-hotfix','./js/pages/growth-curve.js?v=r23-hotfix','./js/pages/sleep-management.js?v=r23-hotfix','./js/pages/medical.js?v=r23-hotfix','./js/pages/footprint.js?v=r23-hotfix','./js/pages/exercise.js?v=r23-hotfix','./js/pages/food.js?v=r23-hotfix','./js/pages/early-edu.js?v=r23-hotfix','./js/pages/language-development.js?v=r23-hotfix','./js/pages/social-development.js?v=r23-hotfix','./js/pages/safety.js?v=r23-hotfix','./js/pages/parenting-lib.js?v=r23-hotfix','./js/focus-guide.js?v=r23-hotfix','./js/pages/profile-page.js?v=r23-hotfix','./js/pages/screening.js?v=r23-hotfix','./js/pages.js?v=r23-hotfix','./js/pages/message-center-page.js?v=r23-hotfix','./js/app.js?v=r23-hotfix'];

// ===== 安装：预缓存核心静态资源 =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // 立即激活，不等待旧 SW
  self.skipWaiting();
});

// ===== 激活：清理旧缓存 + 通知客户端（页面侧决定是否自动刷新） =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating production R23 release...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith('oneone-production-') && key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim()
    ).then(() => {
      // 通知所有客户端显示"新版本可用"提示
      // 安全加固（v56）：不再 client.navigate() 强制刷新，
      // 避免用户正在填写/未提交的表单因强制重载而丢失
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED' });
      });
    })
  );
});

// ===== 处理来自页面的消息 =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ===== 请求拦截 =====
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname === '/service-worker.js') {
    event.respondWith(fetch(new Request(request, { cache: 'no-cache' })));
    return;
  }
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/feeding') || url.pathname.startsWith('/stool') || url.pathname.startsWith('/sleep') || url.pathname.startsWith('/health') || url.pathname.startsWith('/family') || url.pathname.startsWith('/baby') || url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return;
  if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(new Request(request, { cache: 'no-cache' })).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
