// AI 小样集市 · 后端服务
// 技术栈：Node 原生 http + node:sqlite + SSE 实时同步
// 复用 login-dsm 思路：轻量持久化 + 多端实时同步 + 角色鉴权

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8765;
const PUBLIC_DIR = join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ---------- 数据库 ----------
const db = new DatabaseSync(join(DATA_DIR, 'hub.db'));
db.exec(`PRAGMA journal_mode = WAL;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    icon TEXT,
    cover_color TEXT,
    scenario TEXT,
    tech TEXT,
    ai_attr TEXT,
    experience_type TEXT,
    external_url TEXT,
    cold_start INTEGER DEFAULT 0,
    status TEXT DEFAULT '已上线',
    creator TEXT,
    rating_avg REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    try_count INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_id TEXT,
    rating INTEGER DEFAULT 0,
    content TEXT,
    contact TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'creator',
    display_name TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    expires_at TEXT
  );
`);

// ---------- 鉴权工具 ----------
function hashPw(pw) {
  const salt = randomBytes(16).toString('hex');
  const h = scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${h}`;
}
function verifyPw(pw, stored) {
  const [salt, h] = (stored || '').split(':');
  if (!salt || !h) return false;
  const hh = scryptSync(pw, salt, 64).toString('hex');
  return hh === h;
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const kv of raw.split(';')) {
    const [k, v] = kv.trim().split('=');
    if (k) out[k] = decodeURIComponent(v || '');
  }
  return out;
}
function getSessionUser(req) {
  const { sid } = parseCookies(req);
  if (!sid) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(sid);
  if (!s) return null;
  if (new Date(s.expires_at) < new Date()) { db.prepare('DELETE FROM sessions WHERE token=?').run(sid); return null; }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) || null;
}
function setSession(res, userId) {
  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
}
function clearSession(res, req) {
  const { sid } = parseCookies(req);
  if (sid) db.prepare('DELETE FROM sessions WHERE token=?').run(sid);
  res.setHeader('Set-Cookie', `sid=; Path=/; HttpOnly; Max-Age=0`);
}

// ---------- 种子数据 ----------
const SEED = [
  { id:'s01', slug:'login-dsm', title:'教务系统（底座）', summary:'统一登录与权限中枢，支撑小样生态的账号体系', icon:'🗂️', cover_color:'#6366F1', scenario:'工具后台', tech:'自部署代码', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://login-dsm.onrender.com', cold_start:1, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s02', slug:'match3', title:'三消游戏', summary:'经典三消休闲玩法，规则引擎驱动', icon:'🎮', cover_color:'#EC4899', scenario:'休闲小游戏', tech:'规则引擎', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://match3-server-mnlv.onrender.com/', cold_start:1, creator:'顾耀飞', rating_avg:4.5, rating_count:12 },
  { id:'s03', slug:'reversi', title:'黑白棋对战平台', summary:'奥赛罗本地双人对战，策略博弈', icon:'♟️', cover_color:'#0EA5E9', scenario:'休闲小游戏', tech:'规则引擎', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://4kxfpv15hpfnf.aiforce.cloud/app/app_17cxkwd35sb', cold_start:0, creator:'AI 小样', rating_avg:4.6, rating_count:28 },
  { id:'s04', slug:'hardware-master', title:'硬件闯关大师', summary:'10 关 100 题硬件知识闯关，豆包 AI 生成', icon:'🔧', cover_color:'#10B981', scenario:'知识答题', tech:'AI生成', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://4kxfpv15hpfnf.aiforce.cloud/app/app_17czk1mk3mm', cold_start:0, creator:'顾耀飞', rating_avg:4.8, rating_count:53 },
  { id:'s05', slug:'vocab-feishu', title:'职教高考英语词汇练习', summary:'飞书应用 · 职教高考词汇专项训练（可对外开放）', icon:'📚', cover_color:'#F59E0B', scenario:'教育考试', tech:'低代码(aiforce·飞书)', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://4kxfpv15hpfnf.feishuapp.com/app/app_17d2cb4xnd', cold_start:0, creator:'顾耀飞', rating_avg:4.7, rating_count:34 },
  { id:'s06', slug:'nt-exam-sim', title:'南通中考英语模拟系统', summary:'改革版 7 题型限时模拟，自动生成报告', icon:'📝', cover_color:'#3B82F6', scenario:'教育考试', tech:'纯前端题库', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://4kxfpv15hpfnf.aiforce.cloud/app/app_17dhgpmdn6g', cold_start:0, creator:'顾耀飞', rating_avg:4.9, rating_count:41 },
  { id:'s07', slug:'sxt-kaozhong', title:'苏锡通中考查漏补缺', summary:'近 10 年题型专项训练，纯前端 + 本地管理后台', icon:'📖', cover_color:'#14B8A6', scenario:'教育考试', tech:'纯前端题库', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://sxt-kaozhong-2026.netlify.app/', cold_start:0, creator:'顾耀飞', rating_avg:4.6, rating_count:22 },
  { id:'s08', slug:'twilight', title:'暮光契约·校园卡牌', summary:'校园主题卡牌对战游戏', icon:'🃏', cover_color:'#8B5CF6', scenario:'休闲小游戏', tech:'自部署代码', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://4kxfpv15hpfnf.aiforce.cloud/app/app_17dj2by0n5e', cold_start:0, creator:'顾耀飞', rating_avg:4.4, rating_count:17 },
  { id:'s09', slug:'nt-eng-trainer', title:'南通中考英语专项训练', summary:'nt-eng-trainer · 中考英语专项突破', icon:'🎯', cover_color:'#F43F5E', scenario:'教育考试', tech:'自部署代码', ai_attr:'传统互动Demo', experience_type:'link', external_url:'https://nt-eng-trainer.onrender.com/', cold_start:1, creator:'顾耀飞', rating_avg:4.7, rating_count:19 },
  { id:'s10', slug:'tarot-v16', title:'塔罗占卜站 V1.6', summary:'星空+记忆主题的塔罗牌占卜，抽牌、解读一应俱全', icon:'🔮', cover_color:'#7C3AED', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://2lk6k3q8.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s11', slug:'birthday-v2', title:'生日站 V2（可定制版）', summary:'生日祝福页，可生成专属链接发给别人', icon:'🎂', cover_color:'#EC4899', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://2lk6k3q8.qwenwork.host/birthday.html', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s12', slug:'wheel-today-v4', title:'今日转盘 V4', summary:'7 大分类 176 个选项的「今天干什么」决策转盘（早/午/晚吃什么、穿、带、玩），清新薄荷配色', icon:'🎡', cover_color:'#14B8A6', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://3jvzw8t6.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s13', slug:'lucky-wheel-v1', title:'幸运转盘 V1', summary:'空盘自填抽奖转盘，支持从 Word/Excel/TXT/CSV 导入名单，单击随机、长按内定首位，适合班级活动抽奖', icon:'🎰', cover_color:'#F59E0B', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://jlflv7n3.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s14', slug:'launch-deck-52', title:'发布会 Deck 网页版（52页）', summary:'「小袁大王2026发布会」网页版演示文稿，星空主题 52 页', icon:'🚀', cover_color:'#1D4ED8', scenario:'工具后台', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://g97ndxcs.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 }
];

function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) AS c FROM samples').get().c > 0) return;
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO samples
    (id,slug,title,summary,icon,cover_color,scenario,tech,ai_attr,experience_type,external_url,cold_start,status,creator,rating_avg,rating_count,created_at,updated_at)
    VALUES (@id,@slug,@title,@summary,@icon,@cover_color,@scenario,@tech,@ai_attr,@experience_type,@external_url,@cold_start,'已上线',@creator,@rating_avg,@rating_count,@now,@now)`);
  for (const s of SEED) stmt.run({ ...s, now });
  console.log('[seed] 已写入', SEED.length, '个小样');
}
seedIfEmpty();

// 默认管理员账号（独立账号体系，与 login-dsm 无关；可用环境变量 ADMIN_PASSWORD 覆盖）
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'admin123';
if (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get().c === 0) {
  db.prepare('INSERT INTO users (id,username,password,role,display_name,created_at) VALUES (?,?,?,?,?,?)')
    .run('u_admin', 'admin', hashPw(ADMIN_PW), 'admin', '管理员', new Date().toISOString());
  console.log('[seed] 已创建默认管理员 admin / ' + (process.env.ADMIN_PASSWORD ? '***' : 'admin123'));
}

// ---------- SSE 客户端 ----------
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(payload); } catch { sseClients.delete(res); } }
}

// ---------- 工具 ----------
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2' };
function sendJSON(res, code, obj) { res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise((resolve) => { let b=''; req.on('data', c=>b+=c); req.on('end', ()=>{ try{resolve(JSON.parse(b||'{}'))}catch{resolve({})} }); }); }
function rowToSample(r) {
  return { id:r.id, slug:r.slug, title:r.title, summary:r.summary, icon:r.icon, coverColor:r.cover_color, scenario:r.scenario, tech:r.tech, aiAttr:r.ai_attr, experienceType:r.experience_type, externalUrl:r.external_url, coldStart:!!r.cold_start, status:r.status, creator:r.creator, ratingAvg:r.rating_avg, ratingCount:r.rating_count, tryCount:r.try_count, createdAt:r.created_at, updatedAt:r.updated_at };
}

async function serveStatic(req, res, pathname) {
  const safe = pathname.replace(/\.\.+/g, '');
  let filePath = join(PUBLIC_DIR, safe === '/' ? '/index.html' : safe);
  try { const st = await stat(filePath); if (st.isDirectory()) filePath = join(filePath, 'index.html'); }
  catch { filePath = join(PUBLIC_DIR, 'index.html'); }
  try { const buf = await readFile(filePath); res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' }); res.end(buf); }
  catch { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('404 Not Found'); }
}

// ---------- 服务 ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method;

  // SSE
  if (pathname === '/api/stream') {
    res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' });
    res.write('retry: 3000\n\n'); sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 健康检查（供 Render 健康检查 / 探活使用）
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, ts: Date.now() });
  }

  // 受保护页面（无会话跳登录）
  if (pathname === '/studio.html' || pathname === '/review.html') {
    if (!getSessionUser(req)) { res.writeHead(302, { 'Location':'/login.html' }); return res.end(); }
  }

  // 鉴权 API
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { username, password, displayName } = await readBody(req);
    if (!username || !password) return sendJSON(res, 400, { error:'用户名和密码必填' });
    if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return sendJSON(res, 409, { error:'用户名已存在' });
    const id = 'u_' + randomBytes(6).toString('hex');
    db.prepare('INSERT INTO users (id,username,password,role,display_name,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, username, hashPw(password), 'creator', displayName || username, new Date().toISOString());
    return sendJSON(res, 200, { ok:true });
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = await readBody(req);
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (!u || !verifyPw(password, u.password)) return sendJSON(res, 401, { error:'用户名或密码错误' });
    setSession(res, u.id);
    return sendJSON(res, 200, { ok:true, role:u.role, displayName:u.display_name });
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    clearSession(res, req);
    return sendJSON(res, 200, { ok:true });
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    const u = getSessionUser(req);
    return u ? sendJSON(res, 200, { id:u.id, role:u.role, displayName:u.display_name }) : sendJSON(res, 401, { error:'未登录' });
  }

  // 小样列表 / 筛选 / 搜索
  if (pathname === '/api/samples' && method === 'GET') {
    const scenario = url.searchParams.get('scenario');
    const tech = url.searchParams.get('tech');
    const aiAttr = url.searchParams.get('ai_attr');
    const q = (url.searchParams.get('q') || '').trim();
    const sort = url.searchParams.get('sort') || 'hot';
    const status = url.searchParams.get('status') || '已上线'; // 对外默认仅已上线
    let sql = `SELECT * FROM samples WHERE status = $status`;
    const where = []; const params = { $status: status };
    if (scenario) { where.push('scenario = $scenario'); params.$scenario = scenario; }
    if (tech) { where.push('tech = $tech'); params.$tech = tech; }
    if (aiAttr) { where.push('ai_attr = $aiAttr'); params.$aiAttr = aiAttr; }
    if (q) { where.push('(title LIKE $q OR summary LIKE $q OR tech LIKE $q OR scenario LIKE $q)'); params.$q = `%${q}%`; }
    if (where.length) sql += ' AND ' + where.join(' AND ');
    const order = { hot:'try_count DESC, rating_count DESC', new:'created_at DESC', rate:'rating_avg DESC' }[sort] || 'try_count DESC';
    sql += ` ORDER BY ${order}`;
    const rows = db.prepare(sql).all(params);
    return sendJSON(res, 200, { total: rows.length, items: rows.map(rowToSample) });
  }

  // 创建小样（创作者/管理员）
  if (pathname === '/api/samples' && method === 'POST') {
    const u = getSessionUser(req);
    if (!u || !['creator','admin'].includes(u.role)) return sendJSON(res, 401, { error:'请先登录' });
    const b = await readBody(req);
    if (!b.title || !b.externalUrl) return sendJSON(res, 400, { error:'标题与外链必填' });
    const id = 's_' + randomBytes(5).toString('hex');
    const slug = (b.slug || b.title).replace(/\s+/g,'-').toLowerCase() + '-' + id.slice(2,6);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO samples (id,slug,title,summary,icon,cover_color,scenario,tech,ai_attr,experience_type,external_url,cold_start,status,creator,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, slug, b.title, b.summary||'', b.icon||'🧩', b.coverColor||'#2563EB', b.scenario||'其他', b.tech||'自部署代码', b.aiAttr||'传统互动Demo', b.experienceType||'link', b.externalUrl, b.coldStart?1:0, '审核中', u.display_name, now, now);
    broadcast('sample_new', { id });
    return sendJSON(res, 200, { ok:true, id, status:'审核中' });
  }

  // /api/samples/:id 系列
  const m = pathname.match(/^\/api\/samples\/([^/]+)(\/(\w+))?$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const sub = m[3];
    const row = db.prepare('SELECT * FROM samples WHERE id = ? OR slug = ?').get(id, id);

    if (sub === 'try' && method === 'POST') {
      if (!row) return sendJSON(res, 404, { error:'not found' });
      db.prepare('UPDATE samples SET try_count = try_count + 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
      const r = db.prepare('SELECT id, try_count FROM samples WHERE id = ?').get(row.id);
      broadcast('try', { id: r.id, tryCount: r.try_count });
      return sendJSON(res, 200, { ok:true, tryCount: r.try_count });
    }

    if (sub === 'status' && method === 'POST') {
      const u = getSessionUser(req);
      if (!u || u.role !== 'admin') return sendJSON(res, 401, { error:'需要管理员权限' });
      if (!row) return sendJSON(res, 404, { error:'not found' });
      const { status } = await readBody(req);
      if (!['草稿','审核中','已上线','已下线'].includes(status)) return sendJSON(res, 400, { error:'非法状态' });
      db.prepare('UPDATE samples SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), row.id);
      broadcast('status', { id: row.id, status });
      return sendJSON(res, 200, { ok:true, status });
    }

    if (!sub && method === 'GET') {
      if (!row) return sendJSON(res, 404, { error:'not found' });
      const sample = rowToSample(row);
      const similar = db.prepare(`SELECT * FROM samples WHERE status='已上线' AND id != ? AND (scenario = ? OR ai_attr = ?) ORDER BY rating_avg DESC LIMIT 4`).all(sample.id, sample.scenario, sample.aiAttr).map(rowToSample);
      const fb = db.prepare('SELECT rating, content, contact, created_at FROM feedback WHERE sample_id = ? ORDER BY created_at DESC LIMIT 5').all(sample.id);
      return sendJSON(res, 200, { sample, similar, recentFeedback: fb });
    }

    if (!sub && (method === 'PUT' || method === 'DELETE')) {
      const u = getSessionUser(req);
      if (!u) return sendJSON(res, 401, { error:'请先登录' });
      if (!row) return sendJSON(res, 404, { error:'not found' });
      if (u.role !== 'admin' && row.creator !== u.display_name) return sendJSON(res, 403, { error:'只能管理自己的小样' });
      if (method === 'DELETE') {
        db.prepare('DELETE FROM samples WHERE id = ?').run(row.id);
        return sendJSON(res, 200, { ok:true });
      }
      const b = await readBody(req);
      db.prepare(`UPDATE samples SET title=?, summary=?, icon=?, cover_color=?, scenario=?, tech=?, ai_attr=?, experience_type=?, external_url=?, cold_start=?, updated_at=? WHERE id=?`)
        .run(b.title, b.summary, b.icon, b.coverColor, b.scenario, b.tech, b.aiAttr, b.experienceType, b.externalUrl, b.coldStart?1:0, new Date().toISOString(), row.id);
      return sendJSON(res, 200, { ok:true });
    }
  }

  // 反馈
  if (pathname === '/api/feedback' && method === 'POST') {
    const b = await readBody(req);
    const { sampleId, rating = 0, content = '', contact = '' } = b;
    if (!sampleId) return sendJSON(res, 400, { error:'sampleId required' });
    const row = db.prepare('SELECT * FROM samples WHERE id = ? OR slug = ?').get(sampleId, sampleId);
    if (!row) return sendJSON(res, 404, { error:'sample not found' });
    db.prepare('INSERT INTO feedback (sample_id, rating, content, contact, created_at) VALUES (?,?,?,?,?)').run(row.id, rating, content, contact, new Date().toISOString());
    const newCount = row.rating_count + 1;
    const newAvg = (row.rating_avg * row.rating_count + (rating || 0)) / newCount;
    db.prepare('UPDATE samples SET rating_avg = ?, rating_count = ?, updated_at = ? WHERE id = ?').run(newAvg, newCount, new Date().toISOString(), row.id);
    const updated = db.prepare('SELECT id, rating_avg, rating_count FROM samples WHERE id = ?').get(row.id);
    broadcast('feedback', { id: updated.id, ratingAvg: updated.rating_avg, ratingCount: updated.rating_count, sampleTitle: row.title });
    return sendJSON(res, 200, { ok:true, ratingAvg: updated.rating_avg, ratingCount: updated.rating_count });
  }

  // 创作者：我的小样
  if (pathname === '/api/studio/mine' && method === 'GET') {
    const u = getSessionUser(req);
    if (!u) return sendJSON(res, 401, { error:'请先登录' });
    const rows = db.prepare(`SELECT * FROM samples WHERE creator = ? ORDER BY created_at DESC`).all(u.display_name);
    return sendJSON(res, 200, { items: rows.map(rowToSample) });
  }

  // 审核台：全部小样（按状态筛选）
  if (pathname === '/api/review' && method === 'GET') {
    const u = getSessionUser(req);
    if (!u || u.role !== 'admin') return sendJSON(res, 401, { error:'需要管理员权限' });
    const status = url.searchParams.get('status');
    let sql = `SELECT * FROM samples`;
    if (status) sql += ` WHERE status = ?`;
    sql += ` ORDER BY created_at DESC`;
    const rows = status ? db.prepare(sql).all(status) : db.prepare(sql).all();
    return sendJSON(res, 200, { items: rows.map(rowToSample) });
  }

  // 看板
  if (pathname === '/api/dashboard' && method === 'GET') {
    const samples = db.prepare(`SELECT id, title, icon, try_count, rating_count, rating_avg FROM samples ORDER BY try_count DESC`).all();
    const totalFb = db.prepare('SELECT COUNT(*) AS c FROM feedback').get().c;
    const fb = db.prepare('SELECT f.sample_id, s.title, f.rating, f.content, f.contact, f.created_at FROM feedback f LEFT JOIN samples s ON s.id = f.sample_id ORDER BY f.created_at DESC LIMIT 30').all();
    return sendJSON(res, 200, { samples, totalFeedback: totalFb, recent: fb });
  }

  // 静态
  if (method === 'GET') return serveStatic(req, res, pathname);
  sendJSON(res, 404, { error:'not found' });
});

server.listen(PORT, () => console.log(`AI 小样集市 已启动 → http://localhost:${PORT}`));
