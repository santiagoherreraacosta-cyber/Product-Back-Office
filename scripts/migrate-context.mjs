import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, '00_Orquestador.md');
const targetPath = path.join(root, 'data', 'context_documents.json');

const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('## 6. Contexto Dropi embebido');
const end = source.indexOf('\n## 7. ', start);
if (start === -1 || end === -1) throw new Error('No se encontró la sección 6 del orquestador.');
const section = source.slice(start, end).trim();
const parts = [...section.matchAll(/^###\s+(6\.\d+)\s+(.+)$/gm)];
const intro = section.slice(0, parts[0]?.index ?? section.length).replace(/^## 6\. Contexto Dropi embebido\s*/, '').trim();
const now = new Date().toISOString();
const docs = [];
let order = 1;
if (intro) {
  docs.push(makeDoc('contexto-dropi', 'Contexto Dropi embebido', intro, order++, now));
}
for (let i = 0; i < parts.length; i++) {
  const match = parts[i];
  const next = parts[i + 1];
  const contentStart = match.index + match[0].length;
  const contentEnd = next?.index ?? section.length;
  const title = match[2].replace(/\s+`\[CONFIRMAR\]`$/, '').trim();
  docs.push(makeDoc(slugify(title), `${match[1]} ${title}`, section.slice(contentStart, contentEnd).trim(), order++, now));
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, JSON.stringify({ migratedFrom: '00_Orquestador.md#6', migratedAt: now, documents: docs }, null, 2) + '\n');
console.log(`Migrados ${docs.length} documentos a ${path.relative(root, targetPath)}`);

function makeDoc(slug, title, content, sortOrder, timestamp) {
  const pendingCount = (content.match(/\[CONFIRMAR[^\]]*\]/g) ?? []).length + (title.includes('[CONFIRMAR]') ? 1 : 0);
  return { id: slug, title, content, sortOrder, pendingCount, updatedAt: timestamp, updatedBy: 'migration', version: 1, versions: [{ version: 1, title, content, pendingCount, updatedAt: timestamp, updatedBy: 'migration', reason: 'Migración inicial desde 00_Orquestador.md sección 6.' }] };
}
function slugify(value) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
