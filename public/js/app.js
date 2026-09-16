// 首页逻辑：列表 / 筛选 / 搜索 / 排序 / 体验
const state = { scenario:'', ai_attr:'', tech:'', q:'', sort:'hot' };

const grid = document.getElementById('grid');
const countTip = document.getElementById('countTip');

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

function stars(avg, count){
  const n = Math.round(avg*10)/10;
  return `<span class="star">★ ${n||'—'}${count?`<small> (${count})</small>`:''}</span>`;
}

function card(s){
  const aiTag = s.aiAttr === 'AI辅助生成' || s.aiAttr === 'AI原生'
    ? `<span class="tag ai">${s.aiAttr}</span>` : '';
  const cold = s.coldStart ? `<span class="cold">⏳ 冷启动</span>` : '';
  const aiFlag = (s.aiAttr === 'AI辅助生成' || s.aiAttr === 'AI原生') ? `<span class="ai-flag">AI</span>` : '';
  return `<div class="card">
    <div class="cover" style="background:${s.coverColor}">${s.icon}${cold}${aiFlag}</div>
    <div class="card-body">
      <h3>${s.title}</h3>
      <div class="desc">${s.summary}</div>
      <div class="tags">
        <span class="tag sc">${s.scenario}</span>
        <span class="tag">${s.tech}</span>
        ${aiTag}
      </div>
      <div class="row">
        ${stars(s.ratingAvg, s.ratingCount)}
        <button class="try" data-id="${s.id}" data-cold="${s.coldStart}" data-url="${s.externalUrl}">体验</button>
      </div>
    </div>
  </div>`;
}

async function load(){
  const p = new URLSearchParams();
  if(state.scenario) p.set('scenario', state.scenario);
  if(state.ai_attr) p.set('ai_attr', state.ai_attr);
  if(state.tech) p.set('tech', state.tech);
  if(state.q) p.set('q', state.q);
  p.set('sort', state.sort);
  countTip.textContent = '加载中…';
  const r = await fetch('/api/samples?' + p.toString());
  const data = await r.json();
  countTip.textContent = `共 ${data.total} 个小样` + (state.q?` · 关键词「${state.q}」`:'');
  grid.innerHTML = data.items.length ? data.items.map(card).join('')
    : `<p style="color:#6B7280;grid-column:1/-1;padding:40px 0">没有匹配的小样，试试其他筛选条件。</p>`;
}

// 筛选 pills（场景 / AI 属性）
document.querySelectorAll('.pill').forEach(el=>{
  el.addEventListener('click', ()=>{
    const f = el.dataset.f;
    // 同组互斥
    document.querySelectorAll(`.pill[data-f="${f}"]`).forEach(x=>x.classList.remove('active'));
    el.classList.add('active');
    state[f] = el.dataset.v;
    load();
  });
});
document.getElementById('tech').addEventListener('change', e=>{ state.tech = e.target.value; load(); });
document.getElementById('sort').addEventListener('change', e=>{ state.sort = e.target.value; load(); });

let searchTimer;
document.getElementById('search').addEventListener('input', e=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{ state.q = e.target.value.trim(); load(); }, 300);
});

// 体验：冷启动提示 + 计数
grid.addEventListener('click', async e=>{
  const btn = e.target.closest('.try');
  if(!btn) return;
  const { id, cold, url } = btn.dataset;
  // 计数
  fetch(`/api/samples/${id}/try`, { method:'POST' }).catch(()=>{});
  if(cold === '1'){
    showColdModal(url);
  } else {
    window.open(url, '_blank');
    toast('已在新标签页打开体验');
  }
});

const modal = document.getElementById('modal');
function showColdModal(url){
  document.getElementById('modalSpin').style.display = 'block';
  document.getElementById('modalTitle').textContent = '正在唤醒服务';
  document.getElementById('modalText').textContent = '免费托管实例首次访问需十几秒启动，请稍候…';
  const go = document.getElementById('modalGo');
  go.style.display = 'none';
  modal.classList.add('show');
  // 预热：后台访问一次
  fetch(url, { mode:'no-cors' }).catch(()=>{});
  setTimeout(()=>{
    document.getElementById('modalSpin').style.display = 'none';
    document.getElementById('modalTitle').textContent = '服务已就绪';
    document.getElementById('modalText').textContent = '点击下方按钮前往体验（若仍白屏，请刷新一次）。';
    go.style.display = 'inline-block';
    go.onclick = ()=>{ window.open(url, '_blank'); modal.classList.remove('show'); };
  }, 6000);
}
modal.addEventListener('click', e=>{ if(e.target === modal) modal.classList.remove('show'); });

load();
