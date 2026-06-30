import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

let failures = 0;
globalThis.describe = (name, fn) => { console.log(`\n${name}`); fn(); };
globalThis.it = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}`); console.error(error); }
};
function makeExpect(actual) {
  return {
    toBe: (expected) => assert.equal(actual, expected),
    toEqual: (expected) => assert.deepEqual(actual, expected),
    toContain: (expected) => assert.ok(actual.includes(expected)),
    toMatchObject: (expected) => Object.entries(expected).forEach(([k,v]) => v?.__contains ? assert.ok(actual[k].includes(v.value)) : assert.deepEqual(actual[k], v)),
    toHaveBeenCalledOnce: () => assert.equal(actual.mock.calls.length, 1),
    toHaveBeenCalledWith: (...args) => assert.deepEqual(actual.mock.calls.at(-1), args),
  };
}
makeExpect.stringContaining = (value) => ({ __contains: true, value });
globalThis.expect = makeExpect;
globalThis.vi = { fn: (impl = () => {}) => { const f = (...args) => { f.mock.calls.push(args); return impl(...args); }; f.mock = { calls: [] }; return f; } };

async function importTests(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await importTests(path);
    else if (entry.name.endsWith(".test.js")) await import(`../${path}`);
  }
}
await importTests("tests/unit");
await importTests("tests/integration");
if (failures) process.exit(1);
