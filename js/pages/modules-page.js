/**
 * 功能模块入口页 — 6模块网格自适应一屏
 */
window.ModulesPage = {
  render(container) {
    const modules = [...APP_CONFIG.modules, { key: 'parenting-lib', name: '育儿百科', icon: 'book-open', desc: '按月龄浏览确定性育儿知识', color: '#13C2C2', available: true }];
    let html = `<div class="func-grid">`;

    for (const m of modules) {
      const onclick = m.available
        ? `showPage('${m.key}')`
        : `Utils.showToast('${m.name}即将上线')`;
      const badge = m.available ? '' : '<div class="fc-badge">即将上线</div>';
      // v95 批次F：v2 通道模块图标 emoji → Lucide（有映射才替换；v1 保持 emoji）
      const iconHTML = Lucide.icon(m.icon || 'circle-dot', 24);
      html += `
        <div class="func-card ${m.available ? '' : 'disabled'}" onclick="${onclick}">
          ${badge}
          <div class="fc-icon" style="background:${m.color}18;color:${m.color}">${iconHTML}</div>
          <div class="fc-name">${m.name}</div>
          <div class="fc-desc">${m.desc}</div>
        </div>
      `;
    }

    html += `<div class="func-card" onclick="showPage('messages')"><div class="fc-icon" style="background:#4A90D918;color:#4A90D9">${Lucide.icon('inbox', 24)}</div><div class="fc-name">消息中心</div><div class="fc-desc">待确认、同步失败和提醒</div></div>`;
    html += '</div>';
    container.innerHTML = html;
  }
};
