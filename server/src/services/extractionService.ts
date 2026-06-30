const FIELD_STATUS = ["confirmed", "hypothesis", "missing", "needs_confirmation"];
const PHASES = ["F0", "F1", "F2", "F3"];
const ANIMATION = "fillpop";

function fieldSchema(type, options = {}) {
  return { type, ...options };
}

export const BriefUpdateSchema = createObjectSchema("BriefUpdate", {
  phase: fieldSchema("enum", { values: PHASES }),
  behavior: fieldSchema("string", { optional: true }),
  segment: fieldSchema("string", { optional: true }),
  metric: fieldSchema("string", { optional: true }),
  cause: fieldSchema("string", { optional: true }),
  evidence: fieldSchema("array", { optional: true, itemType: "string" }),
  intervention: fieldSchema("string", { optional: true }),
  expectedChange: fieldSchema("string", { optional: true }),
});

export const ExperimentUpdateSchema = createObjectSchema("ExperimentUpdate", {
  phase: fieldSchema("literal", { value: "F3" }),
  hypothesis: fieldSchema("string", { optional: true }),
  intervention: fieldSchema("string", { optional: true }),
  successCriteria: fieldSchema("string", { optional: true }),
  failureCriteria: fieldSchema("string", { optional: true }),
  duration: fieldSchema("string", { optional: true }),
  sample: fieldSchema("string", { optional: true }),
});

export const RiskUpdateSchema = createObjectSchema("RiskUpdate", {
  phase: fieldSchema("enum", { values: PHASES }),
  risk: fieldSchema("string"),
  reason: fieldSchema("string"),
  accepted: fieldSchema("boolean", { optional: true }),
});

export const PatternCandidateSchema = createObjectSchema("PatternCandidate", {
  name: fieldSchema("string"),
  trigger: fieldSchema("string"),
  evidence: fieldSchema("array", { itemType: "string" }),
  reusableWhen: fieldSchema("string", { optional: true }),
});

const SCHEMAS = {
  brief: BriefUpdateSchema,
  experiment: ExperimentUpdateSchema,
  risk: RiskUpdateSchema,
  pattern: PatternCandidateSchema,
};

function createObjectSchema(name, fields) {
  return {
    name,
    fields,
    parse(input) {
      const errors = [];
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`${name} must be an object`);
      }
      const output = {};
      for (const key of Object.keys(input)) {
        if (!fields[key] && !["type", "source", "confidence", "status", "fieldStatuses"].includes(key)) {
          errors.push(`Unknown field: ${key}`);
        }
      }
      for (const [key, spec] of Object.entries(fields)) {
        const value = input[key];
        if (value === undefined || value === null || value === "") {
          if (!spec.optional) errors.push(`Missing required field: ${key}`);
          continue;
        }
        if (!matchesSpec(value, spec)) errors.push(`Invalid ${key}: expected ${describeSpec(spec)}`);
        else output[key] = value;
      }
      if (input.source !== undefined) output.source = requireString(input.source, "source", errors);
      if (input.confidence !== undefined) output.confidence = requireConfidence(input.confidence, errors);
      if (input.status !== undefined) output.status = requireStatus(input.status, errors);
      if (input.fieldStatuses !== undefined) output.fieldStatuses = requireFieldStatuses(input.fieldStatuses, fields, errors);
      if (errors.length) throw new Error(`${name} validation failed: ${errors.join("; ")}`);
      return output;
    },
  };
}

function matchesSpec(value, spec) {
  if (spec.type === "string") return typeof value === "string";
  if (spec.type === "boolean") return typeof value === "boolean";
  if (spec.type === "literal") return value === spec.value;
  if (spec.type === "enum") return spec.values.includes(value);
  if (spec.type === "array") return Array.isArray(value) && value.every((item) => typeof item === spec.itemType);
  return false;
}

function describeSpec(spec) {
  if (spec.type === "literal") return JSON.stringify(spec.value);
  if (spec.type === "enum") return spec.values.join(" | ");
  if (spec.type === "array") return `${spec.itemType}[]`;
  return spec.type;
}

function requireString(value, key, errors) {
  if (typeof value !== "string" || !value.trim()) errors.push(`Invalid ${key}: expected non-empty string`);
  return value;
}

function requireConfidence(value, errors) {
  if (typeof value !== "number" || value < 0 || value > 1) errors.push("Invalid confidence: expected number from 0 to 1");
  return value;
}

function requireStatus(value, errors) {
  if (!FIELD_STATUS.includes(value)) errors.push(`Invalid status: expected ${FIELD_STATUS.join(" | ")}`);
  return value;
}

function requireFieldStatuses(value, fields, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("Invalid fieldStatuses: expected object");
    return value;
  }
  for (const [field, status] of Object.entries(value)) {
    if (!fields[field]) errors.push(`Unknown field status target: ${field}`);
    if (!FIELD_STATUS.includes(status)) errors.push(`Invalid status for ${field}: ${status}`);
  }
  return value;
}

export function extractValidatedPatches(modelResponse, conversation, options = {}) {
  const response = normalizeResponse(modelResponse);
  const type = response.type || options.type || "brief";
  const schema = SCHEMAS[type];
  if (!schema) throw new Error(`Unsupported extraction type: ${type}`);

  const updates = Array.isArray(response.updates) ? response.updates : [response.update || response.data || response];
  const conversationText = normalizeConversation(conversation);
  const patches = [];

  for (const rawUpdate of updates) {
    const update = schema.parse(rawUpdate);
    for (const field of Object.keys(schema.fields)) {
      if (update[field] === undefined) continue;
      const status = resolveStatus(field, update, conversationText);
      const confidence = resolveConfidence(status, update.confidence);
      patches.push({
        field,
        value: update[field],
        source: resolveSource(field, update, conversationText),
        confidence,
        status,
        animation: ANIMATION,
      });
    }
  }

  return patches;
}

export function validateModelResponse(modelResponse, conversation, options = {}) {
  return extractValidatedPatches(modelResponse, conversation, options);
}

function normalizeResponse(response) {
  if (typeof response === "string") return JSON.parse(response);
  return response;
}

function normalizeConversation(conversation) {
  if (Array.isArray(conversation)) {
    return conversation.map((turn) => typeof turn === "string" ? turn : `${turn.role || ""}: ${turn.content || ""}`).join("\n");
  }
  return String(conversation || "");
}

function resolveStatus(field, update, conversationText) {
  const explicit = update.fieldStatuses?.[field] || update.status;
  if (explicit === "confirmed" && !hasEvidence(update[field], update.source, conversationText)) return "needs_confirmation";
  if (explicit) return explicit;
  if (isMissingValue(update[field])) return "missing";
  return hasEvidence(update[field], update.source, conversationText) ? "confirmed" : "needs_confirmation";
}

function resolveConfidence(status, explicitConfidence) {
  if (typeof explicitConfidence === "number") return explicitConfidence;
  if (status === "confirmed") return 0.9;
  if (status === "hypothesis") return 0.55;
  if (status === "needs_confirmation") return 0.35;
  return 0;
}

function resolveSource(field, update, conversationText) {
  if (update.source && conversationText.toLowerCase().includes(String(update.source).toLowerCase())) return update.source;
  if (hasEvidence(update[field], undefined, conversationText)) return "conversation";
  return "needs_confirmation";
}

function isMissingValue(value) {
  return value === null || value === undefined || value === "" || value === "[CONFIRMAR]";
}

function hasEvidence(value, source, conversationText) {
  if (isMissingValue(value)) return false;
  const haystack = conversationText.toLowerCase();
  if (source && haystack.includes(String(source).toLowerCase())) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => {
    const normalized = String(item).toLowerCase().trim();
    if (normalized.length < 4) return false;
    if (haystack.includes(normalized)) return true;
    return normalized.split(/\s+/).filter((word) => word.length > 3).some((word) => haystack.includes(word));
  });
}
