// 数据看板：统计卡片 + 实时反馈流（SSE）
const cards = document.getElementById('cards');
const feed = document.getElementById('feed');

function statCard(s){
  return `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:16px">
    <div style="font-size:26px">${s.icon}</div>
    <div style="font-weight:700;margin:6px 0 2px">${s.title}</div>
    <div style="font-size:13px;color:#6B7280">体验 ${s.try_count} 次 · 评分 ${s.rating_count} 条</div>
    <div style="color:#F59E0B;font-size:13px">★ ${Math.round(s.rating_avg*10)/10||'—'}</div>
  </div>`;
}

async function load(){
  const r = await fetch('/api/dashboard');
  const d = await r.json();
  cards.innerHTML = d.samples.map(statCard).join('');
  feed.innerHTML = d.recent.length
    ? d.recent.map(f=>`<div style="border-top:1px solid #F3F4F6;padding:8px 0;font-size:13px">
        <b>${f.title||'未知'}</b> ${'★'.repeat(f.rating||0)} — ${f.content||'(无文字)'}${f.contact?` · ${f.contact}`:''}
        <span style="color:#9CA3AF;font-size:12px"> ${new Date(f.created_at).toLocaleString('zh-CN')}</span></div>`).join('')
    : '<div style="color:#9CA3AF;font-size:13px">暂无反馈</div>';
}

// SSE 实时刷新
const es = new EventSource('/api/stream');
function prependFeed(d){
  const el = document.createElement('div');
  el.style.cssText = 'border-top:1px solid #F3F4F6;padding:8px 0;font-size:13px;background:#ECFDF5';
  el.innerHTML = `🆕 <b>${d.sampleTitle}</b> 收到新反馈 ★${d.ratingAvg?.toFixed?.(1)||''} <span style="color:#9CA3AF;font-size:12px">刚刚</span>`;
  feed.prepend(el);
  load(); // 刷新统计
}
es.addEventListener('feedback', e=>prependFeed(JSON.parse(e.data)));
es.addEventListener('try', ()=>load());

load();
