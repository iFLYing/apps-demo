// 一次性脚本：把 5 个新站点插入现有数据库（已存在则跳过）
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const db = new DatabaseSync(join(DATA_DIR, 'hub.db'));

const NEW = [
  { id:'s10', slug:'tarot-v16', title:'塔罗占卜站 V1.6', summary:'星空+记忆主题的塔罗牌占卜，抽牌、解读一应俱全', icon:'🔮', cover_color:'#7C3AED', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://2lk6k3q8.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s11', slug:'birthday-v2', title:'生日站 V2（可定制版）', summary:'生日祝福页，可生成专属链接发给别人', icon:'🎂', cover_color:'#EC4899', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://2lk6k3q8.qwenwork.host/birthday.html', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s12', slug:'wheel-today-v4', title:'今日转盘 V4', summary:'7 大分类 176 个选项的「今天干什么」决策转盘（早/午/晚吃什么、穿、带、玩），清新薄荷配色', icon:'🎡', cover_color:'#14B8A6', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://3jvzw8t6.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s13', slug:'lucky-wheel-v1', title:'幸运转盘 V1', summary:'空盘自填抽奖转盘，支持从 Word/Excel/TXT/CSV 导入名单，单击随机、长按内定首位，适合班级活动抽奖', icon:'🎰', cover_color:'#F59E0B', scenario:'趣味工具', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://jlflv7n3.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
  { id:'s14', slug:'launch-deck-52', title:'发布会 Deck 网页版（52页）', summary:'「小袁大王2026发布会」网页版演示文稿，星空主题 52 页', icon:'🚀', cover_color:'#1D4ED8', scenario:'工具后台', tech:'低代码(qwenwork)', ai_attr:'AI辅助生成', experience_type:'link', external_url:'https://g97ndxcs.qwenwork.host', cold_start:0, creator:'顾耀飞', rating_avg:0, rating_count:0 },
];

const stmt = db.prepare(`INSERT INTO samples
  (id,slug,title,summary,icon,cover_color,scenario,tech,ai_attr,experience_type,external_url,cold_start,status,creator,rating_avg,rating_count,created_at,updated_at)
  VALUES (@id,@slug,@title,@summary,@icon,@cover_color,@scenario,@tech,@ai_attr,@experience_type,@external_url,@cold_start,'已上线',@creator,@rating_avg,@rating_count,@now,@now)`);

const now = new Date().toISOString();
let added = 0, skipped = 0;
for (const s of NEW) {
  const exist = db.prepare('SELECT 1 FROM samples WHERE id = ?').get(s.id);
  if (exist) { skipped++; continue; }
  stmt.run({ ...s, now });
  added++;
}
const total = db.prepare('SELECT COUNT(*) AS c FROM samples').get().c;
console.log(`插入 ${added} 个，跳过 ${skipped} 个（已存在）；当前共 ${total} 个小样`);
db.close();
