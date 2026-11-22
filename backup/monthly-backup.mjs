// Monthly backup of everything in the database. Runs on GitHub's free scheduler (see .github/workflows/monthly-backup.yml).
// It reads every record with the Supabase service key, packs it exactly like the "Backup" button of the tool (format 1),
// compresses it, ENCRYPTS it with your passphrase (AES-256-GCM), and emails the file to you. A copy stays in GitHub for 90 days.
// To restore: open tools/open-backup.html on your computer, choose the file, type the passphrase, save the .json,
// then use Settings > Restore in the tool.
//
// Secrets (GitHub > Settings > Secrets and variables > Actions):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, BACKUP_TO (where to send it), BACKUP_PASSPHRASE
//   BACKUP_FROM (optional, default accounts@publicforcesecurity.com)
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const env = process.env;
const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RESEND_API_KEY', 'BACKUP_TO', 'BACKUP_PASSPHRASE'];
const missing = need.filter((k) => !String(env[k] || '').trim());
if (missing.length) { console.error('Missing settings: ' + missing.join(', ') + '. Add them under Settings > Secrets and variables > Actions.'); process.exit(1); }
if (String(env.BACKUP_PASSPHRASE).length < 12) { console.error('BACKUP_PASSPHRASE must be at least 12 characters.'); process.exit(1); }
const BASE = env.SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_KEY;
const RESEND = env.RESEND_URL || 'https://api.resend.com/emails';
const FROM = env.BACKUP_FROM || 'accounts@publicforcesecurity.com';
const TO = env.BACKUP_TO.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
const MAX_EMAIL_BYTES = (Number(env.BACKUP_MAX_EMAIL_MB) || 28) * 1024 * 1024; // the file is sent as base64 inside the email; the email service allows about 40 MB

async function rest(path, opt = {}) {
  const r = await fetch(BASE + '/rest/v1/' + path, { ...opt, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('Database said ' + r.status + ' for ' + path.split('?')[0] + ': ' + (await r.text()).slice(0, 200));
  return r;
}

const collections = {}; let total = 0;
for (let from = 0; ; from += 1000) {
  const r = await rest('documents?select=collection,id,data&order=collection.asc,id.asc', { headers: { Range: from + '-' + (from + 999), 'Range-Unit': 'items' } });
  const rows = await r.json();
  for (const row of rows) { (collections[row.collection] = collections[row.collection] || {})[row.id] = row.data; total++; }
  if (rows.length < 1000) break;
}
if (!total) { console.error('The database returned no records, so no backup was made.'); process.exit(1); }
let staff = [];
try { staff = await (await rest('profiles?select=id,email,full_name,role')).json(); } catch (e) { /* the staff list is optional */ }
const counts = {}; Object.keys(collections).forEach((k) => { counts[k] = Object.keys(collections[k]).length; });
const now = new Date();
const out = { app: 'Public Force HR, payroll and billing', format: 1, exportedAt: now.toISOString(), exportedBy: 'automatic monthly backup', records: total, counts, staffAccounts: staff, collections };

const plain = gzipSync(Buffer.from(JSON.stringify(out), 'utf8'), { level: 9 });
const salt = randomBytes(16), iv = randomBytes(12);
const key = pbkdf2Sync(env.BACKUP_PASSPHRASE, salt, 250000, 32, 'sha256');
const c = createCipheriv('aes-256-gcm', key, iv);
const body = Buffer.concat([c.update(plain), c.final()]);
const file = Buffer.concat([Buffer.from('PFSSBK1'), salt, iv, body, c.getAuthTag()]);   // magic, salt, iv, ciphertext + tag
const day = now.toISOString().slice(0, 10), name = 'PFSS-backup-' + day + '.json.gz.enc';
mkdirSync('backup-output', { recursive: true }); writeFileSync('backup-output/' + name, file);
console.log('Backup file: ' + name + ', ' + total + ' records, ' + file.length + ' bytes.');

const tooBig = file.length > MAX_EMAIL_BYTES;
const text = 'Monthly backup of the Public Force tool, ' + day + '.\n\n' + total.toLocaleString('en-IN') + ' records in ' + Object.keys(counts).length + ' collections.\n' +
  (tooBig ? '\nThe file is too large to email (' + Math.round(file.length / 1048576) + ' MB). It is saved in GitHub: Actions > Monthly backup > the latest run > Artifacts (kept 90 days).\n'
          : '\nThe backup is attached. It is ENCRYPTED: without the passphrase it cannot be read.\n') +
  '\nTo restore: open tools/open-backup.html on a computer, choose the file, type the passphrase and save the .json it gives you; then in the tool use Settings > Restore.\nKeep the passphrase safe. If it is lost, the backups cannot be opened.';
const mail = { from: FROM, to: TO, subject: 'PFSS monthly backup ' + day + ' (' + total + ' records)', text };
if (!tooBig) mail.attachments = [{ filename: name, content: file.toString('base64') }];
const er = await fetch(RESEND, { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(mail) });
if (!er.ok) { console.error('The email service said ' + er.status + ': ' + (await er.text()).slice(0, 200) + '. The encrypted file is still saved in the GitHub run.'); process.exit(1); }
console.log('Emailed to ' + TO.join(', ') + (tooBig ? ' (notice only: too large to attach)' : '') + '.');

// let the tool show the date of the last automatic backup
await rest('documents?on_conflict=collection,id', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ collection: 'backupLog', id: 'auto', data: { at: Date.now(), records: total, bytes: file.length, to: TO.join(', '), emailed: !tooBig, by: 'automatic' } }]) });
console.log('Done.');
