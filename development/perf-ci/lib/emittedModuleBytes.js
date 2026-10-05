/**
 * Charge every module the bytes it actually contributes to a bundle.
 *
 * The startup graph budgets used to measure `sourcesContent`: the
 * pre-compile TypeScript, comments and type declarations included. None of
 * that reaches the browser — the minifier strips comments and the compiler
 * erases types — so a module's measured weight had little to do with what it
 * costs to download and parse. Writing a paragraph of rationale above a
 * function moved the budget as much as shipping the same number of bytes of
 * code.
 *
 * Walking the source map's `mappings` instead attributes each span of the
 * emitted file to the module it came from, which is what the budget is meant
 * to bound. Bytes no segment claims — the bundler runtime and its glue — are
 * reported separately rather than charged to a module.
 */

const fs = require('fs');
const path = require('path');

const BASE64 = new Int32Array(128).fill(-1);
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  .split('')
  .forEach((char, index) => {
    BASE64[char.charCodeAt(0)] = index;
  });

const COMMA = 44;
const SEMICOLON = 59;
const VLQ_CONTINUATION = 32;
const VLQ_VALUE_MASK = 31;

/**
 * Decode a source map `mappings` string.
 *
 * Returns one entry per generated line, each holding that line's segments as
 * `[generatedColumn, sourceIndex, sourceLine, sourceColumn]`. A segment that
 * names no source is `[generatedColumn]` alone.
 */
function decodeSourceMapMappings(mappings) {
  const lines = [];
  let segments = [];
  let fieldCount = 0;
  let value = 0;
  let shift = 0;
  let generatedColumn = 0;
  let sourceIndex = 0;
  let sourceLine = 0;
  let sourceColumn = 0;

  const pushSegment = () => {
    if (fieldCount > 0) {
      segments.push(
        fieldCount >= 4
          ? [generatedColumn, sourceIndex, sourceLine, sourceColumn]
          : [generatedColumn],
      );
      fieldCount = 0;
    }
  };

  const applyField = (delta) => {
    if (fieldCount === 0) generatedColumn += delta;
    else if (fieldCount === 1) sourceIndex += delta;
    else if (fieldCount === 2) sourceLine += delta;
    else if (fieldCount === 3) sourceColumn += delta;
    fieldCount += 1;
  };

  for (let index = 0; index < mappings.length; index += 1) {
    const code = mappings.charCodeAt(index);
    if (code === COMMA) {
      pushSegment();
    } else if (code === SEMICOLON) {
      pushSegment();
      lines.push(segments);
      segments = [];
      generatedColumn = 0;
    } else {
      const digit = BASE64[code];
      if (digit >= 0) {
        value += (digit & VLQ_VALUE_MASK) << shift;
        if (digit & VLQ_CONTINUATION) {
          shift += 5;
        } else {
          const negative = value & 1;
          const magnitude = value >>> 1;
          // "-0" is how the format spells the smallest representable value.
          let delta = magnitude;
          if (negative) {
            delta = magnitude === 0 ? -0x80_00_00_00 : -magnitude;
          }
          applyField(delta);
          value = 0;
          shift = 0;
        }
      }
    }
  }
  pushSegment();
  lines.push(segments);
  return lines;
}

/**
 * Emitted bytes per module for one generated file and its source map.
 *
 * A segment owns the generated text from its own column to the next
 * segment's, so the per-line spans partition the file exactly: the module
 * totals and `unmappedBytes` add up to the file's own size.
 */
function attributeFileBytes({ code, map }) {
  const sources = map.sources || [];
  const lines = code.split('\n');
  const decoded = decodeSourceMapMappings(map.mappings || '');
  const bytesBySource = new Map();
  let unmappedBytes = 0;

  const charge = (source, bytes) => {
    if (bytes > 0) {
      if (source === undefined) {
        unmappedBytes += bytes;
      } else {
        bytesBySource.set(source, (bytesBySource.get(source) || 0) + bytes);
      }
    }
  };

  for (let line = 0; line < lines.length; line += 1) {
    const text = lines[line];
    const hasNewline = line < lines.length - 1;
    const segments = decoded[line];
    if (!segments || segments.length === 0) {
      unmappedBytes += Buffer.byteLength(text) + (hasNewline ? 1 : 0);
    } else {
      const sorted = [...segments].toSorted(
        (left, right) => left[0] - right[0],
      );
      // Anything before the first segment belongs to no module.
      unmappedBytes += Buffer.byteLength(text.slice(0, sorted[0][0]));
      for (let index = 0; index < sorted.length; index += 1) {
        const start = sorted[index][0];
        const end =
          index + 1 < sorted.length ? sorted[index + 1][0] : text.length;
        charge(
          sorted[index].length >= 4 ? sources[sorted[index][1]] : undefined,
          Buffer.byteLength(text.slice(start, end)),
        );
      }
      if (hasNewline) unmappedBytes += 1;
    }
  }

  return { bytesBySource, unmappedBytes };
}

/**
 * Emitted bytes per module across a set of generated files.
 *
 * Totals are summed rather than maxed: a module duplicated across two chunks
 * is downloaded twice, and that is the cost the budget should see.
 *
 * Files without a source map contribute nothing here; callers report them
 * through their own `missingSourceMaps` check.
 */
function collectEmittedModuleBytes({ buildDir, files, normalizeSource }) {
  const modules = new Map();
  let unmappedBytes = 0;

  for (const file of files) {
    const mapPath = path.join(buildDir, `${file}.map`);
    if (fs.existsSync(mapPath)) {
      const attributed = attributeFileBytes({
        code: fs.readFileSync(path.join(buildDir, file), 'utf8'),
        map: JSON.parse(fs.readFileSync(mapPath, 'utf8')),
      });
      unmappedBytes += attributed.unmappedBytes;
      for (const [rawSource, bytes] of attributed.bytesBySource) {
        const source = normalizeSource(rawSource);
        const existing = modules.get(source);
        if (existing) {
          existing.bytes += bytes;
          existing.files.add(file);
        } else {
          modules.set(source, { source, bytes, files: new Set([file]) });
        }
      }
    }
  }

  return { modules, unmappedBytes };
}

module.exports = {
  attributeFileBytes,
  collectEmittedModuleBytes,
  decodeSourceMapMappings,
};
