/**
 * coop-v2.js — R4 多角色协作 UI（v2 通道专属，v1 零加载）
 *
 * 1) 成员色点：按加入顺序（createdAt）分配 6 个类别色槽位，
 *    映射存 localStorage.babycare_memberColors（30min 缓存，云端 family getInfo 兜底刷新）
 * 2) 首页「最近谁在记录」动态条渲染（最近 N 条记录去重取记录人）
 * 3) 同步状态细条：top-bar 下方，三态（已同步 / 离线待同步 / 同步失败点击重试）
 *    —— 复用现有 30s 轮询与 navigator.onLine 事件，仅加 UI，不引入新同步逻辑
 */
(function () {
  if (!window.__UI_V3__) return;

  var COLORS = ['category-1', 'category-2', 'category-3', 'category-4', 'category-5', 'category-6'];
  var STORE_KEY = 'babycare_memberColors';
  var CACHE_TTL = 30 * 60 * 1000; // 30min

  function ls() { return window.localStorage; }

  var CoopV2 = {
    COLORS: COLORS,
    _members: null,     // { memberId: { nickname, colorIdx, role, createdAt } }
    _lastFetch: 0,
    _syncState: 'synced',

    /** 确保成员色映射已加载（本地缓存 → 云端 getInfo 兜底刷新） */
    async ensureColors(force) {
      var now = Date.now();
      if (this._members && !force && now - this._lastFetch < CACHE_TTL) return this._members;

      var local = null;
      try { local = JSON.parse(ls().getItem(STORE_KEY) || 'null'); } catch (e) { local = null; }
      if (local && local._members && !force && now - (local._ts || 0) < CACHE_TTL) {
        this._members = local._members;
        this._lastFetch = now;
        return this._members;
      }

      try {
        var auth = (window.Auth && Auth.getLocalAuth) ? Auth.getLocalAuth() : null;
        if (!auth || !auth.familyId) { this._members = local ? local._members : {}; return this._members; }
        var res = await window.API.call(APP_CONFIG.functions.family, {
          action: 'getInfo', payload: { familyId: auth.familyId }
        });
        var members = (res && res.members) || [];
        // 按加入顺序排序（createdAt 升序）
        members.sort(function (a, b) { return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); });
        var map = {};
        members.forEach(function (m, i) {
          map[m.memberId] = {
            nickname: m.nickname || '未知',
            colorIdx: i % COLORS.length,
            role: m.role || 'member',
            createdAt: m.createdAt
          };
        });
        this._members = map;
        try { ls().setItem(STORE_KEY, JSON.stringify({ _ts: now, _members: map })); } catch (e) {}
      } catch (e) {
        // 拉取失败：降级本地缓存（可能为空 → 色点回落灰色）
        this._members = local ? local._members : {};
      }
      this._lastFetch = now;
      return this._members;
    },

    colorVar(memberId) {
      var m = this._members && this._members[memberId];
      return m ? 'var(--color-' + COLORS[m.colorIdx] + ')' : '#C9CDD4';
    },
    nicknameOf(memberId) {
      var m = this._members && this._members[memberId];
      return m ? m.nickname : '';
    },
    dotHTML(memberId, nickname, sizePx) {
      var c = this.colorVar(memberId);
      var n = nickname || this.nicknameOf(memberId) || '未知';
      var size = sizePx || 8;
      return '<span class="coop-dot" style="background:' + c + ';width:' + size + 'px;height:' + size + 'px"></span>' +
             '<span class="coop-name">' + Utils.escapeHtml(n) + '</span>';
    },

    /** 从记录池取最近 N 个去重记录人（记录字段 recorderMemberId 优先，memberId 兜底） */
    recentRecorders(recordsPool, max) {
      var pool = (recordsPool || []).filter(function (r) { return r && (r.recorderMemberId || r.memberId); });
      pool.sort(function (a, b) { return new Date(b.time || b.createdAt || 0) - new Date(a.time || a.createdAt || 0); });
      var seen = {}, list = [];
      for (var i = 0; i < pool.length; i++) {
        var mid = pool[i].recorderMemberId || pool[i].memberId;
        if (seen[mid]) continue;
        seen[mid] = true;
        list.push(mid);
        if (list.length >= (max || 3)) break;
      }
      return list;
    },

    /** 渲染「最近谁在记录」动态条（无记录返回空串，由调用方决定是否显示空态） */
    renderRecent(recordsPool, max) {
      var ids = this.recentRecorders(recordsPool, max);
      if (!ids.length) return '';
      var dots = ids.map(function (mid) {
        var m = this._members && this._members[mid];
        return this.dotHTML(mid, m ? m.nickname : '');
      }, this).join('<span class="coop-sep">·</span>');
      return '<div class="coop-recent" id="coop-recent">' +
        '<div class="coop-recent-title"><span style="display:inline-flex;align-items:center;vertical-align:-3px;margin-right:4px">' + Lucide.icon('users', 16) + '</span> 最近谁在记录</div>' +
        '<div class="coop-recent-body">' + dots + '</div></div>';
    },

    /* ---------- 同步状态细条 ---------- */
    ensureSyncBar() {
      if (document.getElementById('sync-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'sync-bar';
      bar.className = 'sync-bar synced';
      bar.setAttribute('role', 'status');
      var top = document.getElementById('top-bar');
      (top && top.parentNode ? top.parentNode : document.body).insertBefore(bar, top ? top.nextSibling : null);

      var self = this;
      // R8：online 不再直接 synced，先回线 flush 离线队列
      window.addEventListener('online', function () {
        self.setState('syncing');
        var p = (window.Utils) ? Utils.flushPending() : Promise.resolve({ synced: 0, failed: 0 });
        p.then(function (res) {
          if (res.synced > 0 && window.Utils) {
            Utils.showToast(' ' + res.synced + ' 条记录已同步', 2500, 'success');
          }
          self.setState(res.failed > 0 ? 'error' : 'synced');
        });
      });
      window.addEventListener('offline', function () {
        self.setState('pending');
        self.refreshPending();
      });
      // error 态点击重试：先 flush 队列，再触发云端版本轮询
      bar.addEventListener('click', function () {
        if (self._syncState !== 'error') return;
        self.setState('syncing');
        var p = (window.Utils) ? Utils.flushPending() : Promise.resolve({ synced: 0, failed: 0 });
        p.then(function (res) {
          if (res.failed > 0) { self.setState('error'); return; }
          if (window.App && App._pollSync) {
            App._pollSync().then(function () { self.setState('synced'); }).catch(function () { self.setState('error'); });
          } else {
            self.setState('synced');
          }
        });
      });
      // R8：启动时已有待同步且在线 → 延迟回线同步（如刷新页面后网络已恢复）
      if (window.Utils && Utils.getPendingCount() > 0 && navigator.onLine !== false) {
        setTimeout(function () {
          Utils.flushPending().then(function (res) {
            if (res.synced > 0 && window.Utils) Utils.showToast(' ' + res.synced + ' 条记录已同步', 2500, 'success');
            self.setState(res.failed > 0 ? 'error' : 'synced');
          });
        }, 3000);
      }
      if (navigator.onLine === false) { this.setState('pending'); this.refreshPending(); }
    },

    setState(state) {
      this._syncState = state;
      var bar = document.getElementById('sync-bar');
      if (!bar) return;
      bar.className = 'sync-bar ' + state;
      var label;
      if (state === 'pending') {
        var n = (window.Utils) ? Utils.getPendingCount() : 0;
        label = n > 0 ? n + ' 条待同步 · 联网自动同步' : '离线 · 记录已存本机，联网自动同步';
      } else {
        label = { synced: '', error: '同步失败 · 点击重试', syncing: '同步中…' }[state] || '';
      }
      bar.innerHTML = label;
    },

    /** P4 离线队列接入后：待同步条数变化时刷新 pending 文案 */
    refreshPending() {
      if (this._syncState === 'pending') this.setState('pending');
    }
  };

  window.CoopV2 = CoopV2;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { CoopV2.ensureSyncBar(); });
  } else {
    CoopV2.ensureSyncBar();
  }
})();
