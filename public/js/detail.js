// 详情页逻辑：展示 / 体验 / 评分 / 反馈 / 相似推荐 / 实时同步
const id = new URLSearchParams(location.search).get('id');
const root = document.getElementById('detail');
const toast = (m)=>{ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); };

let current = null;

function starsInputHtml(){
  let s='';
  for(let i=1;i<=5;i++) s+=`<span data-v="${i}">★</span>`;
  return `<div class="stars-input" id="stars">${s}</div>`;
}

async function load(){
  const r = await fetch('/api/samples/' + encodeURIComponent(id));
  if(r.status === 404){ root.innerHTML = '<p style="padding:40px;color:#6B7280">小样不存在</p>'; return; }
  const data = await r.json();
  current = data.sample;
  const s = current;
  const aiTag = (s.aiAttr==='AI辅助生成'||s.aiAttr==='AI原生') ? `<span class="tag ai">${s.aiAttr}</span>` : '';

  const fbHtml = data.recentFeedback.length
    ? data.recentFeedback.map(f=>`<div class="fb-item">${'★'.repeat(f.rating||0)} ${f.content||'(无文字)'}${f.contact?` · 联系：${f.contact}`:''}<div class="m">${new Date(f.created_at).toLocaleString('zh-CN')}</div></div>`).join('')
    : '<div class="fb-item">还没有反馈，来做第一个吧！</div>';

  const simHtml = data.similar.length
    ? data.similar.map(x=>`<div class="sim" onclick="location.href='/detail.html?id=${x.id}'"><div class="t">${x.icon} ${x.title}</div><div class="s">${x.scenario} · ${x.tech}</div></div>`).join('')
    : '<div class="s">暂无相似小样</div>';

  root.innerHTML = `
    <div>
      <div class="exp-box" style="background:${s.coverColor}">
        <div class="big">${s.icon}</div>
        <h2>${s.title}</h2>
        <p>${s.summary}</p>
        <button id="expBtn">${s.coldStart?'唤醒并体验':'前往体验 →'}</button>
      </div>
    </div>
    <div>
      <div class="panel" style="margin-bottom:20px">
        <h4>📋 小样信息</h4>
        <div class="meta-row">
          <span class="tag sc">${s.scenario}</span>
          <span class="tag">${s.tech}</span>
          ${aiTag}
          <span class="tag">状态：${s.status}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:14px;margin-top:6px">
          <div class="score-big">${Math.round(s.ratingAvg*10)/10||'—'}<small> / 5 平均分</small></div>
          <div style="color:#6B7280;font-size:13px">体验 ${s.tryCount} 次 · 评分 ${s.ratingCount} 条</div>
        </div>
        <div style="color:#6B7280;font-size:13px;margin-top:8px">创作者：${s.creator||'—'}</div>
      </div>

      <div class="panel" style="margin-bottom:20px">
        <h4>⭐ 评分与反馈</h4>
        <form id="fbForm">
          <label>你的评分</label>
          ${starsInputHtml()}
          <label>文字反馈（可选）</label>
          <textarea id="fbContent" rows="3" placeholder="这个 demo 怎么样？想提什么需求？"></textarea>
          <label>联系方式（可选，便于我们回访）</label>
          <input type="text" id="fbContact" placeholder="微信 / 手机号 / 邮箱">
          <button type="submit" class="submit">提交反馈</button>
        </form>
        <div class="fb-list" id="fbList">${fbHtml}</div>
      </div>

      <div class="panel">
        <h4>🔗 相似小样</h4>
        <div class="similar">${simHtml}</div>
      </div>
    </div>`;

  bindExp();
  bindStars();
  bindForm();
}

function bindExp(){
  document.getElementById('expBtn').addEventListener('click', ()=>{
    fetch(`/api/samples/${current.id}/try`, { method:'POST' }).catch(()=>{});
    if(current.coldStart){ showCold(current.externalUrl); }
    else { window.open(current.externalUrl, '_blank'); toast('已在新标签页打开体验'); }
  });
}

let rating = 0;
function bindStars(){
  const stars = document.querySelectorAll('#stars span');
  stars.forEach(sp=>{
    sp.addEventListener('click', ()=>{
      rating = +sp.dataset.v;
      stars.forEach(x=>x.classList.toggle('on', +x.dataset.v <= rating));
    });
    sp.addEventListener('mouseover', ()=>{
      stars.forEach(x=>x.classList.toggle('on', +x.dataset.v <= +sp.dataset.v));
    });
  });
  document.getElementById('stars').addEventListener('mouseleave', ()=>{
    stars.forEach(x=>x.classList.toggle('on', +x.dataset.v <= rating));
  });
}

function bindForm(){
  document.getElementById('fbForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const content = document.getElementById('fbContent').value.trim();
    const contact = document.getElementById('fbContact').value.trim();
    const r = await fetch('/api/feedback', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sampleId: current.id, rating, content, contact })
    });
    const data = await r.json();
    if(data.ok){
      toast('反馈已提交，感谢！');
      document.getElementById('fbContent').value='';
      document.getElementById('fbContact').value='';
      rating=0; document.querySelectorAll('#stars span').forEach(x=>x.classList.remove('on'));
      // 刷新平均分
      document.querySelector('.score-big').innerHTML = `${Math.round(data.ratingAvg*10)/10}<small> / 5 平均分</small>`;
      load();
    } else toast('提交失败：' + (data.error||'未知错误'));
  });
}

// 冷启动 modal
const modal = document.getElementById('modal');
function showCold(url){
  document.getElementById('modalSpin').style.display='block';
  document.getElementById('modalTitle').textContent='正在唤醒服务';
  document.getElementById('modalText').textContent='免费托管实例首次访问需十几秒启动，请稍候…';
  const go=document.getElementById('modalGo'); go.style.display='none';
  modal.classList.add('show');
  fetch(url,{mode:'no-cors'}).catch(()=>{});
  setTimeout(()=>{
    document.getElementById('modalSpin').style.display='none';
    document.getElementById('modalTitle').textContent='服务已就绪';
    document.getElementById('modalText').textContent='点击下方按钮前往体验（若仍白屏，请刷新一次）。';
    go.style.display='inline-block';
    go.onclick=()=>{ window.open(url,'_blank'); modal.classList.remove('show'); };
  },6000);
}
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('show'); });

// SSE：实时同步评分/体验变化
const es = new EventSource('/api/stream');
es.addEventListener('feedback', ev=>{
  const d = JSON.parse(ev.data);
  if(current && d.id === current.id){
    document.querySelector('.score-big').innerHTML = `${Math.round(d.ratingAvg*10)/10}<small> / 5 平均分</small>`;
  }
});

load();
