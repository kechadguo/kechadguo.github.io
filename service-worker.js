/**
 * OneOne成长日记 — Service Worker
 * 策略：Cache First（静态资源）+ Network First（API 数据）
 */
const CACHE_NAME = 'oneone-production-r22';
const STATIC_ASSETS = ['./','./index.html','./manifest.json','./css/v3-runtime.css','./js/theme-v3.js','./js/config.js','./js/production-runtime-config.js','./js/data/vaccine-schedule.js','./js/data/growth-standard.js','./js/data/region-data.js','./js/data/milestone-standard.js','./js/data/badges-data.js','./js/data/nursing-standard.js','./js/data/exercise-plan.js','./js/data/food-plan.js','./js/data/knowledge-parenting.js','./js/data/early-edu-courses.js','./js/utils.js','./js/auth.js','./js/api.js','./js/breast-feeding.js','./js/feeding-time-chart.js','./js/voice.js','./js/pages.js','./js/app.js'];

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
  console.log('[SW] Activating production R22...');
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
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/feeding') || url.pathname.startsWith('/stool') || url.pathname.startsWith('/sleep') || url.pathname.startsWith('/health') || url.pathname.startsWith('/family') || url.pathname.startsWith('/baby') || url.pathname.startsWith('/api/')) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
