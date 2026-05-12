/**
 * Generates cli-api.d.ts from the zod schema registry.
 *
 * Run from apps/cli/:
 *   node -r esbuild-register scripts/generate-cli-types.ts
 *
 * Or via package.json script:
 *   yarn generate:cli-types
 *
 * Note: zod-to-ts v2 requires zod v4. This project uses zod v3,
 * so we use zod-to-json-schema and convert JSON Schema → TS interfaces.
 */
import * as fs from 'fs';
import * as path from 'path';

// Populate the registry
import '../src/schemas/register-all';
import { getSchemaRegistry } from '../src/schemas/registry';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { zodToJsonSchema } = require('zod-to-json-schema') as {
  zodToJsonSchema: (schema: unknown, name?: string) => Record<string, unknown>;
};

// ─── JSON Schema → TypeScript interface converter ────────────────────────────

type IJsonSchemaNode = Record<string, unknown>;

/** Full schema document passed through for $ref resolution */
interface ISchemaDoc {
  definitions?: Record<string, IJsonSchemaNode>;
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Resolve a JSON Pointer path against a document.
 * E.g. "#/definitions/Foo/properties/chain" → resolves step by step.
 */
function resolveRef(ref: string, doc: ISchemaDoc): IJsonSchemaNode | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = doc;
  for (const part of parts) {
    if (node === null || node === undefined || typeof node !== 'object')
      return undefined;
    node = node[part];
  }
  return node as IJsonSchemaNode | undefined;
}

/** Returns true if the key needs to be quoted (not a valid JS identifier) */
function needsQuotes(key: string): boolean {
  return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

/**
 * Convert a JSON Schema node to a TypeScript type string.
 * Inline $refs are resolved against the full schema document.
 */
function getTypeName(
  node: IJsonSchemaNode,
  doc: ISchemaDoc,
  indent: string,
): string {
  if (node.$ref) {
    const ref = node.$ref as string;
    // Carry over any description but resolve the actual type from $ref
    const resolved = resolveRef(ref, doc);
    if (resolved) {
      // Merge description from the referencing node into the resolved node
      const merged: IJsonSchemaNode = { ...resolved };
      if (node.description) merged.description = node.description;
      return getTypeName(merged, doc, indent);
    }
    // Fallback: strip #/definitions/ prefix for top-level refs
    const shortRef = ref.replace(/^#\/definitions\//, '');
    return shortRef.replace(/\//g, '_');
  }

  const rawType = node.type as string | string[] | undefined;
  const anyOf = node.anyOf as IJsonSchemaNode[] | undefined;
  const allOf = node.allOf as IJsonSchemaNode[] | undefined;
  const oneOf = node.oneOf as IJsonSchemaNode[] | undefined;
  const enumValues = node.enum as unknown[] | undefined;

  // Handle type arrays like ["string", "null"] from z.string().nullable()
  if (Array.isArray(rawType)) {
    const types = rawType.map((t) => {
      if (t === 'null') return 'null';
      if (t === 'string') return 'string';
      if (t === 'number' || t === 'integer') return 'number';
      if (t === 'boolean') return 'boolean';
      return 'unknown';
    });
    return types.join(' | ');
  }

  const type = rawType;

  if (enumValues) {
    return enumValues.map((v) => JSON.stringify(v)).join(' | ');
  }

  if (anyOf) {
    return anyOf.map((n) => getTypeName(n, doc, indent)).join(' | ');
  }

  if (oneOf) {
    return oneOf.map((n) => getTypeName(n, doc, indent)).join(' | ');
  }

  if (allOf) {
    return allOf.map((n) => getTypeName(n, doc, indent)).join(' & ');
  }

  if (!type) {
    // Handle empty schema (z.unknown(), z.any())
    return 'unknown';
  }

  if (type === 'string') return 'string';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'null') return 'null';

  if (type === 'array') {
    const items = node.items as IJsonSchemaNode | undefined;
    const itemType = items ? getTypeName(items, doc, indent) : 'unknown';
    const needsParens = itemType.includes(' | ') || itemType.includes(' & ');
    return needsParens ? `(${itemType})[]` : `${itemType}[]`;
  }

  if (type === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return renderObjectLiteral(node, doc, indent);
  }

  return 'unknown';
}

function renderObjectLiteral(
  node: IJsonSchemaNode,
  doc: ISchemaDoc,
  indent: string,
): string {
  const properties = node.properties as
    | Record<string, IJsonSchemaNode>
    | undefined;
  const required = (node.required as string[] | undefined) ?? [];
  const additionalProperties = node.additionalProperties;

  if (!properties || Object.keys(properties).length === 0) {
    if (additionalProperties && typeof additionalProperties === 'object') {
      const valType = getTypeName(
        additionalProperties as IJsonSchemaNode,
        doc,
        `${indent}  `,
      );
      return `{ [key: string]: ${valType} }`;
    }
    // Empty object schema (z.object({})) or additionalProperties: false → {}
    return '{}';
  }

  const nextIndent = `${indent}  `;
  const lines: string[] = ['{'];

  for (const [key, propSchema] of Object.entries(properties)) {
    const isRequired = required.includes(key);
    const optional = isRequired ? '' : '?';
    const description = propSchema.description as string | undefined;
    const typeName = getTypeName(propSchema, doc, nextIndent);
    const quotedKey = needsQuotes(key) ? `'${key}'` : key;

    if (description) {
      lines.push(`${nextIndent}/** ${description} */`);
    }
    lines.push(`${nextIndent}${quotedKey}${optional}: ${typeName};`);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function jsonSchemaToInterface(
  schemaDoc: Record<string, unknown>,
  interfaceName: string,
): string {
  const doc = schemaDoc as ISchemaDoc;
  // zodToJsonSchema wraps in definitions when a name is provided
  const rootDef: IJsonSchemaNode | undefined = doc.definitions
    ? doc.definitions[interfaceName]
    : (schemaDoc as IJsonSchemaNode);

  if (!rootDef) {
    return `export interface ${interfaceName} {}`;
  }

  // Handle non-object root schemas (e.g. z.array(...))
  const rootType = rootDef.type as string | string[] | undefined;
  if (rootType !== 'object' && rootType !== undefined) {
    const tsType = getTypeName(rootDef, doc, '');
    return `export type ${interfaceName} = ${tsType}`;
  }

  // Handle anyOf/oneOf at root level
  if (rootDef.anyOf || rootDef.oneOf) {
    const tsType = getTypeName(rootDef, doc, '');
    return `export type ${interfaceName} = ${tsType}`;
  }

  const body = renderObjectLiteral(rootDef, doc, '');
  return `export interface ${interfaceName} ${body}`;
}

// ─── Main generation ─────────────────────────────────────────────────────────

function generate(): string {
  const lines: string[] = [
    '/* eslint-disable */',
    '// @generated — do not edit manually',
    '// Generated from zod schemas in src/schemas/',
    '// Run: yarn generate:cli-types',
    `// Generated at: ${new Date().toISOString()}`,
    '',
  ];

  const registry = getSchemaRegistry();

  for (const [name, entry] of registry) {
    const pascal = toPascalCase(name);
    const inputName = `${pascal}Input`;
    const outputName = `${pascal}Output`;

    const inputJson = zodToJsonSchema(entry.input, inputName);
    const outputJson = zodToJsonSchema(entry.output, outputName);

    lines.push(`/** ${entry.description} */`);
    lines.push(jsonSchemaToInterface(inputJson, inputName));
    lines.push('');
    lines.push(jsonSchemaToInterface(outputJson, outputName));
    lines.push('');
  }

  return lines.join('\n');
}

const outPath = path.resolve(__dirname, '..', 'cli-api.d.ts');
const content = generate();
fs.writeFileSync(outPath, content, 'utf-8');
console.log(`Generated ${outPath} (${content.split('\n').length} lines)`);
