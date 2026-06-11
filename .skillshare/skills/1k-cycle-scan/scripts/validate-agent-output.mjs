#!/usr/bin/env node
/**
 * Strict validator for 1k-cycle-scan agent outputs.
 *
 * The orchestrator must run this before accepting scan/refute agent output.
 * Invalid output is sent back to the agent with stderr as the repair brief.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--schema') args.schema = argv[(i += 1)];
    else if (a === '--file') args.file = argv[(i += 1)];
    else if (a === '--out') args.out = argv[(i += 1)];
    else if (a === '--group') args.group = argv[(i += 1)];
    else if (a === '--group-id') args.groupId = Number(argv[(i += 1)]);
    else if (a === '--repo') args.repo = argv[(i += 1)];
    else if (a === '--rules') args.rules = argv[(i += 1)];
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!['scan', 'refute'].includes(args.schema)) {
    console.error('--schema must be one of: scan, refute');
    process.exit(2);
  }
  if (args.groupId !== undefined && !Number.isInteger(args.groupId)) {
    console.error('--group-id must be an integer');
    process.exit(2);
  }
  return args;
}

function readJsonInput(file) {
  const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  try {
    return { value: JSON.parse(raw) };
  } catch (e) {
    return {
      error: `invalid JSON: ${e.message}. Output must be raw JSON only; no markdown fences or prose.`,
    };
  }
}

function exactKeys(obj, required, optional, path, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push(`${path}: expected object`);
    return;
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in obj)) errors.push(`${path}: missing required key "${key}"`);
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) errors.push(`${path}: unexpected key "${key}"`);
  }
}

function isRelativeRepoPath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.split('/').includes('..')
  );
}

function extractCategoryKeys(rulesFile) {
  if (!rulesFile) return null;
  const text = readFileSync(rulesFile, 'utf8');
  const keys = new Set();
  for (const line of text.split('\n')) {
    const match = line.match(/^###\s+([a-z0-9][a-z0-9-]*)\s+[—-]/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function readGroup(groupFile, groupId, errors) {
  if (!groupFile) return null;
  const body = JSON.parse(readFileSync(groupFile, 'utf8'));
  if (body.files) return body;
  if (Array.isArray(body.groups)) {
    if (groupId !== undefined) {
      return body.groups.find((g) => g.id === groupId) ?? null;
    }
    if (body.groups.length === 1) return body.groups[0];
  }
  errors.push(
    '--group must point to one group object, or pass --group-id for a plan file',
  );
  return null;
}

function lineText(repo, relPath, line) {
  const text = readFileSync(join(repo, relPath), 'utf8').split('\n');
  return text[line - 1] ?? '';
}

function validateFinding(f, index, categories, errors) {
  const path = `findings[${index}]`;
  exactKeys(
    f,
    [
      'path',
      'line',
      'category',
      'severity',
      'title',
      'evidence',
      'suggestion',
      'confidence',
    ],
    [],
    path,
    errors,
  );
  if (!isRelativeRepoPath(f.path))
    errors.push(`${path}.path: expected repo-relative path`);
  if (!Number.isInteger(f.line) || f.line < 1)
    errors.push(`${path}.line: expected positive integer`);
  if (
    typeof f.category !== 'string' ||
    !/^[a-z0-9][a-z0-9-]*$/.test(f.category)
  ) {
    errors.push(`${path}.category: expected kebab-case category key`);
  } else if (categories && !categories.has(f.category)) {
    errors.push(`${path}.category: unknown category "${f.category}"`);
  }
  if (!['P0', 'P1', 'P2'].includes(f.severity)) {
    errors.push(`${path}.severity: expected P0, P1, or P2`);
  }
  if (
    typeof f.title !== 'string' ||
    f.title.length === 0 ||
    f.title.length > 120
  ) {
    errors.push(`${path}.title: expected non-empty string <=120 chars`);
  } else if (/[<>]/.test(f.title) || /https?:\/\//i.test(f.title)) {
    errors.push(`${path}.title: no angle brackets or bare URLs`);
  }
  if (
    typeof f.evidence !== 'string' ||
    f.evidence.length === 0 ||
    f.evidence.length > 500
  ) {
    errors.push(`${path}.evidence: expected non-empty string <=500 chars`);
  } else if (f.evidence.split('\n').length > 3) {
    errors.push(`${path}.evidence: expected <=3 lines`);
  }
  if (
    typeof f.suggestion !== 'string' ||
    f.suggestion.length === 0 ||
    f.suggestion.length > 240
  ) {
    errors.push(`${path}.suggestion: expected non-empty string <=240 chars`);
  }
  if (
    typeof f.confidence !== 'number' ||
    !Number.isFinite(f.confidence) ||
    f.confidence < 0 ||
    f.confidence > 1
  ) {
    errors.push(`${path}.confidence: expected number between 0 and 1`);
  }
}

function validateProbes(probes, group, repo, errors) {
  if (!Array.isArray(probes)) {
    errors.push('probes: expected array');
    return;
  }
  const expected = new Map();
  if (group) {
    for (const f of group.files ?? []) {
      if (f.probeLine) expected.set(`${f.path}:${f.probeLine}`, f);
    }
  }
  if (group && probes.length !== expected.size) {
    errors.push(
      `probes: expected ${expected.size} probe entries, got ${probes.length}`,
    );
  }
  const seen = new Set();
  probes.forEach((p, index) => {
    const path = `probes[${index}]`;
    exactKeys(p, ['path', 'line', 'text'], [], path, errors);
    if (!isRelativeRepoPath(p.path))
      errors.push(`${path}.path: expected repo-relative path`);
    if (!Number.isInteger(p.line) || p.line < 1)
      errors.push(`${path}.line: expected positive integer`);
    if (typeof p.text !== 'string')
      errors.push(`${path}.text: expected string`);
    const key = `${p.path}:${p.line}`;
    if (seen.has(key)) errors.push(`${path}: duplicate probe ${key}`);
    seen.add(key);
    if (group && !expected.has(key))
      errors.push(`${path}: unexpected probe ${key}`);
    if (repo && expected.has(key)) {
      const actual = lineText(repo, p.path, p.line).trim();
      if (p.text.trim() !== actual)
        errors.push(`${path}.text: does not match repo line ${key}`);
    }
  });
  for (const key of expected.keys()) {
    if (!seen.has(key)) errors.push(`probes: missing required probe ${key}`);
  }
}

function validateScan(value, args) {
  const errors = [];
  exactKeys(value, ['findings', 'probes'], [], '$', errors);
  const categories = extractCategoryKeys(args.rules);
  if (!Array.isArray(value.findings)) {
    errors.push('findings: expected array');
  } else {
    value.findings.forEach((f, index) =>
      validateFinding(f, index, categories, errors),
    );
  }
  const group = readGroup(args.group, args.groupId, errors);
  validateProbes(value.probes, group, args.repo, errors);
  return errors;
}

function validateRefute(value) {
  const errors = [];
  exactKeys(value, ['refuted', 'reason'], [], '$', errors);
  if (typeof value.refuted !== 'boolean')
    errors.push('refuted: expected boolean');
  if (
    typeof value.reason !== 'string' ||
    value.reason.length === 0 ||
    value.reason.length > 500
  ) {
    errors.push('reason: expected non-empty string <=500 chars');
  }
  return errors;
}

function main() {
  const args = parseArgs(process.argv);
  let value;
  try {
    const parsed = readJsonInput(args.file);
    if (parsed.error) {
      console.error(parsed.error);
      process.exit(1);
    }
    value = parsed.value;
    const errors =
      args.schema === 'scan'
        ? validateScan(value, args)
        : validateRefute(value);
    if (errors.length > 0) {
      console.error(errors.map((e) => `schema error: ${e}`).join('\n'));
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const normalized = JSON.stringify(value, null, 2);
  if (args.out) writeFileSync(args.out, `${normalized}\n`);
  else console.log(normalized);
}

main();
