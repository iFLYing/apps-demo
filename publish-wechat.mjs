// 微信公众号自动上传脚本（写入草稿箱）
// 用法：WX_APPID=xxx WX_SECRET=yyy node publish-wechat.mjs
// 说明：脚本仅读取环境变量中的凭证，不写入仓库；凭证请通过环境变量传入。

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPID = process.env.WX_APPID;
const SECRET = process.env.WX_SECRET;
const COVER = join(__dirname, '..', '..', 'generated-images', 'Clean_modern_tech_education_he_2026-09-16T11-06-49.png');
const SITE_URL = process.env.SITE_URL || 'https://ai-demos-hub.onrender.com';

if (!APPID || !SECRET) {
  console.error('缺少凭证：请通过环境变量传入 WX_APPID 和 WX_SECRET');
  process.exit(1);
}

const BASE = 'https://api.weixin.qq.com/cgi-bin';

async function getToken() {
  const url = `${BASE}/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.errcode) throw new Error(`获取 access_token 失败：${j.errcode} ${j.errmsg}`);
  return j.access_token;
}

async function uploadImage(token) {
  const buf = await readFile(COVER);
  const blob = new Blob([buf], { type: 'image/png' });
  const form = new FormData();
  form.append('media', blob, 'cover.png');
  const r = await fetch(`${BASE}/material/add_material?access_token=${token}&type=image`, {
    method: 'POST', body: form,
  });
  const j = await r.json();
  if (j.errcode) throw new Error(`上传封面失败：${j.errcode} ${j.errmsg}`);
  return j.media_id;
}

function buildContent() {
  const s = (css, html) => `<section style="${css}">${html}</section>`;
  return [
    s('padding:0 4px;line-height:1.9;color:#3f3f3f;font-size:16px;',
      '各位老师、同行：我们平时用 AI 做了不少有意思的小样——题库、闯关、小游戏、练习工具……散在各处，别人想看想玩都得单独发链接。于是我们把它们聚到一起，做成了这个「AI 小样集市」，一个能在线看、能直接玩、玩完还能提意见的网站。'),
    s('margin:28px 0 12px;font-size:20px;color:#1f2937;border-left:5px solid #10B981;padding-left:12px;font-weight:700;', '一、这是什么？'),
    s('padding:0 4px;line-height:1.9;color:#3f3f3f;font-size:16px;', '简单说，它是一个 <b>AI 能力橱窗 + 在线体验入口</b>。我们把分散在不同平台上的 demo 小样集中到一个站点，访客不用下载、不用注册，打开就能玩，玩完顺手打分、留建议。对内沉淀作品，对外让人一眼看懂「AI 到底能做出什么」。'),
    s('margin:28px 0 12px;font-size:20px;color:#1f2937;border-left:5px solid #10B981;padding-left:12px;font-weight:700;', '二、现在能玩到什么？'),
    s('padding:0 4px;line-height:1.9;color:#3f3f3f;font-size:16px;', '首批已经收录了 <b>9 个</b> 小样，按场景分成几类，覆盖教育和小游戏两条线：'),
    s('margin:14px 0;padding:14px 16px;background:#f7f9fc;border-radius:12px;line-height:1.8;font-size:15px;', '<b>📚 教育考试（4 个）</b><br>南通中考英语模拟系统｜苏锡通中考查漏补缺｜南通中考英语专项训练｜职教高考英语词汇练习<br><span style="color:#777;font-size:14px;">从模拟卷到词汇专项，都是实打实能用的备考工具。</span>'),
    s('margin:14px 0;padding:14px 16px;background:#f7f9fc;border-radius:12px;line-height:1.8;font-size:15px;', '<b>🎮 休闲小游戏（3 个）</b><br>三消游戏｜黑白棋对战平台｜暮光契约·校园卡牌<br><span style="color:#777;font-size:14px;">课间放松、活动展示都能用上。</span>'),
    s('margin:14px 0;padding:14px 16px;background:#ecfdf5;border-radius:12px;line-height:1.8;font-size:15px;', '<b>🧠 知识答题（1 个 · AI 辅助生成）</b><br>硬件闯关大师：10 关 100 题，由 AI 辅助生成内容——这也是我们想重点展示的：「这些小样，很多都能用 AI 快速造出来」。'),
    s('margin:14px 0;padding:14px 16px;background:#f7f9fc;border-radius:12px;line-height:1.8;font-size:15px;', '<b>🛠️ 工具后台（1 个）</b><br>教务系统：支撑整个集市的统一登录与管理底座。'),
    s('margin:28px 0 12px;font-size:20px;color:#1f2937;border-left:5px solid #10B981;padding-left:12px;font-weight:700;', '三、怎么玩？'),
    s('padding:0 4px;line-height:1.9;color:#3f3f3f;font-size:16px;', '① 打开网站首页　② 按场景 / 分类挑一个小样　③ 点「体验」直接玩。每个小样页都标了亮点、适用场景和技术标签，玩完可以打分、写反馈，还能留个联系方式——你的每一条建议，我们都能在后台实时看到。'),
    s('margin:28px 0 12px;font-size:20px;color:#1f2937;border-left:5px solid #10B981;padding-left:12px;font-weight:700;', '四、你也能上新自己的小样'),
    s('padding:0 4px;line-height:1.9;color:#3f3f3f;font-size:16px;', '集市不只是展示，也欢迎投稿。登录创作者后台，填个标题、贴个链接、选好分类，提交后就进入审核；通过后自动上线，所有人都能看到、能玩到。整个「提交 → 审核 → 上线」的闭环已经跑通。'),
    s('margin:32px 0;padding:22px 24px;text-align:center;background:linear-gradient(120deg,#10B981,#34d399);border-radius:14px;color:#fff;', '<b style="font-size:18px;">👉 点击下方「阅读原文」，立即体验</b><br><span style="font-size:14px;opacity:.95;">或浏览器打开：' + SITE_URL + '</span>'),
    s('margin-top:24px;font-size:13px;color:#9aa0a6;text-align:center;line-height:1.8;', 'AI 小样集市 · 由一线教师用 AI 辅助搭建<br>欢迎转发给需要的同事和朋友 ✦'),
  ].join('');
}

async function addDraft(token, thumbMediaId) {
  const body = {
    articles: [{
      title: 'AI 小样集市开张啦｜看得到，更玩得到',
      author: process.env.WX_AUTHOR || 'AI小样集市',
      digest: '9 个 AI 辅助制作的互动小样，免费在线体验，看得到更玩得到。',
      content: buildContent(),
      content_source_url: SITE_URL,
      thumb_media_id: thumbMediaId,
      need_open_comment: 0,
      only_fans_can_comment: 0,
    }],
  };
  const r = await fetch(`${BASE}/draft/add?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.errcode) throw new Error(`创建草稿失败：${j.errcode} ${j.errmsg}`);
  return j.media_id;
}

try {
  const token = await getToken();
  console.log('✓ access_token 获取成功');
  const thumb = await uploadImage(token);
  console.log('✓ 封面素材上传成功 media_id=', thumb);
  const mediaId = await addDraft(token, thumb);
  console.log('✓ 草稿已写入 media_id=', mediaId);
  console.log('下一步：在公众号后台「草稿箱」确认并群发。');
} catch (e) {
  console.error('✗', e.message);
  process.exit(1);
}
