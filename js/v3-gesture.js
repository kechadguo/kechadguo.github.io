/**
 * R3 · 底部 tab 左右滑动手势（v2 专属，index.html 双通道条件注入）
 *
 * 单手操作优化：在 3-tab 主页面内，横向滑动切换底部 tab——
 *   左滑（deltaX < -60px）→ 下一个 tab；右滑（deltaX > 60px）→ 上一个 tab。
 * 约束（不干扰其他交互）：
 *   1. 仅当 |deltaX| ≥ 60px 且 |deltaX| > |deltaY| * 1.5（横向为主）才触发，纵向滚动照常
 *   2. 弹窗（#app-modal 未 hidden）、报表全屏 overlay、非 3-tab 子页面一律不触发
 *   3. 500ms 内完成的滑动才生效（防止误触）
 *   4. passive 监听，不 preventDefault，不阻断任何默认行为
 * 暴露 window.GestureV2 供 smoke 断言。
 */
(function () {
  if (!window.__UI_V3__) return;

  // 与 tab 栏 DOM 顺序一致（index.html）：分析 → 记录 → 首页 → 功能 → AI助手
  var TABS = ['analytics', 'quick-record', 'dashboard', 'functions', 'assistant'];
  var THRESHOLD = 60;
  var TIME_MAX = 500;
  var VERTICAL_RATIO = 1.5;

  var startX = null;
  var startY = null;
  var startT = 0;

  function isTabPage() {
    return typeof Pages !== 'undefined' && TABS.indexOf(Pages.currentTab) >= 0;
  }

  function hasBlockingOverlay() {
    // 通用弹窗（表单/确认 Sheet）
    var modal = document.getElementById('app-modal');
    if (modal && !modal.classList.contains('hidden')) return true;
    // 报表全屏 overlay
    if (document.getElementById('report-overlay')) return true;
    return false;
  }

  function onTouchStart(e) {
    var t = e.touches && e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
    startT = Date.now();
  }

  function onTouchEnd(e) {
    if (startX === null) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    var dt = Date.now() - startT;
    startX = null;
    startY = null;

    if (dt > TIME_MAX) return;
    if (Math.abs(dx) < THRESHOLD) return;
    if (Math.abs(dy) * VERTICAL_RATIO > Math.abs(dx)) return; // 纵向主导 → 忽略
    if (!isTabPage()) return;
    if (hasBlockingOverlay()) return;

    var idx = TABS.indexOf(Pages.currentTab);
    var next = dx < 0 ? TABS[idx + 1] : TABS[idx - 1]; // 左滑 → 下一个；右滑 → 上一个
    if (next) {
      try { showPage(next); } catch (err) { /* 边界防御 */ }
    }
  }

  function onTouchCancel() {
    startX = null;
    startY = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchCancel, { passive: true });

  // 供 smoke/调试断言
  window.GestureV2 = { TABS: TABS, THRESHOLD: THRESHOLD, TIME_MAX: TIME_MAX };
})();
