// Firestore REST API helper — nessuna dipendenza esterna, nessun service account
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const API_KEY    = process.env.VITE_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Serializzazione ──────────────────────────────────

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toValue(v);
  }
  return fields;
}

// ── Deserializzazione ────────────────────────────────

function fromValue(v) {
  if ('nullValue'      in v) return null;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('integerValue'   in v) return parseInt(v.integerValue);
  if ('doubleValue'    in v) return v.doubleValue;
  if ('stringValue'    in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue'       in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromValue(v);
  }
  return obj;
}

function docFromResponse(d) {
  const parts = d.name.split('/');
  return { id: parts[parts.length - 1], ...fromFields(d.fields || {}) };
}

// ── API pubbliche ────────────────────────────────────

/** Query con singolo filtro: queryDocs('live_monitoring', 'status', 'EQUAL', 'active') */
export async function queryDocs(collection, field, op, value) {
  const url = `${BASE}:runQuery?key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op,
            value: toValue(value),
          },
        },
      },
    }),
  });
  const data = await r.json();
  if (!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => docFromResponse(d.document));
}

/** Leggi un documento per ID */
export async function getDoc(collection, docId) {
  const r = await fetch(`${BASE}/${collection}/${docId}?key=${API_KEY}`);
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.fields) return null;
  return docFromResponse(data);
}

/** Crea documento (ID autogenerato), restituisce il nuovo ID */
export async function addDoc(collection, data) {
  const r = await fetch(`${BASE}/${collection}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  const doc = await r.json();
  if (!doc.name) throw new Error(`addDoc failed: ${JSON.stringify(doc)}`);
  const parts = doc.name.split('/');
  return parts[parts.length - 1];
}

/** Aggiorna campi specifici (non tocca gli altri) */
export async function updateDoc(collection, docId, data) {
  const params = new URLSearchParams();
  for (const f of Object.keys(data)) params.append('updateMask.fieldPaths', f);
  params.append('key', API_KEY);
  const r = await fetch(`${BASE}/${collection}/${docId}?${params.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  return r.ok;
}

/** Aggiunge un valore a un array field (atomico, evita duplicati) */
export async function arrayUnion(collection, docId, field, value) {
  const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  await fetch(`${BASE}:commit?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: docPath,
          fieldTransforms: [{
            fieldPath: field,
            appendMissingElements: { values: [toValue(value)] },
          }],
        },
      }],
    }),
  });
}
