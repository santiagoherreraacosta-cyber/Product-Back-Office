import { getContextDocuments } from './contextStore.js';

const STOPWORDS = new Set(['para', 'como', 'con', 'los', 'las', 'una', 'uno', 'que', 'del', 'por', 'dropi', 'contexto']);

export async function contextRetriever(prompt, { limit = 3 } = {}) {
  const { documents, pendingCount } = await getContextDocuments();
  const terms = tokenize(prompt);
  const selected = documents
    .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.doc.sortOrder - b.doc.sortOrder)
    .slice(0, limit)
    .map(({ doc }) => ({ id: doc.id, title: doc.title, content: doc.content, pendingCount: doc.pendingCount, version: doc.version }));
  return { pendingCount, contextBlock: selected.map((doc) => `### ${doc.title}\n${doc.content}`).join('\n\n'), documents: selected };
}

function tokenize(value) { return (value.toLowerCase().match(/[a-záéíóúñ0-9]{3,}/g) ?? []).filter((term) => !STOPWORDS.has(term)); }
function scoreDocument(doc, terms) { const haystack = `${doc.title}\n${doc.content}`.toLowerCase(); return terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0); }
