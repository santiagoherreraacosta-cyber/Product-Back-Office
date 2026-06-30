import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.join(process.cwd(), 'data', 'context_documents.json');
const AUDIT_PATH = path.join(process.cwd(), 'data', 'context_audit.log');
const CONFIRM_RE = /\[CONFIRMAR[^\]]*\]/g;

export async function getContextDocuments() {
  const data = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
  const documents = data.documents.sort((a, b) => a.sortOrder - b.sortOrder).map(withPendingCount);
  return { ...data, pendingCount: documents.reduce((sum, doc) => sum + doc.pendingCount, 0), documents };
}

export async function updateContextDocument(id, patch, actor = 'admin') {
  if (!actor || actor !== 'admin') {
    const error = new Error('Solo admins pueden editar el contexto.');
    error.statusCode = 403;
    throw error;
  }
  const data = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
  const index = data.documents.findIndex((doc) => doc.id === id);
  if (index === -1) {
    const error = new Error('Documento de contexto no encontrado.');
    error.statusCode = 404;
    throw error;
  }
  const current = data.documents[index];
  const next = withPendingCount({ ...current, title: patch.title ?? current.title, content: patch.content ?? current.content, updatedAt: new Date().toISOString(), updatedBy: actor, version: current.version + 1 });
  next.versions = [...(current.versions ?? []), { version: next.version, title: next.title, content: next.content, pendingCount: next.pendingCount, updatedAt: next.updatedAt, updatedBy: actor, reason: patch.reason ?? 'Edición manual de contexto.' }];
  data.documents[index] = next;
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
  await fs.appendFile(AUDIT_PATH, JSON.stringify({ type: 'context_document.updated', id, actor, version: next.version, pendingCount: next.pendingCount, at: next.updatedAt, reason: patch.reason ?? null }) + '\n');
  return next;
}

export function withPendingCount(doc) {
  return { ...doc, pendingCount: `${doc.title}\n${doc.content}`.match(CONFIRM_RE)?.length ?? 0 };
}
