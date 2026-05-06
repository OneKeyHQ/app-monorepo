const fs = require('node:fs');
const path = require('node:path');

const cliRoot = path.resolve(__dirname, '..');
const distCliPath = path.join(cliRoot, 'dist/cli.js');

function getLineNumber(contents, index) {
  return contents.slice(0, index).split('\n').length;
}

function assertNoDeprecatedBufferConstructors() {
  const contents = fs.readFileSync(distCliPath, 'utf8');
  const forbiddenPatterns = [
    {
      name: 'new Buffer',
      pattern: /\bnew\s+Buffer\b/g,
    },
    {
      name: 'Buffer(...)',
      pattern: /\bBuffer\s*\(/g,
      shouldIgnore: (index) => {
        const beforeMatch = contents.slice(Math.max(0, index - 10), index);
        return /(?:new|function)\s+$/.test(beforeMatch);
      },
    },
  ];
  const matches = [];

  for (const forbiddenPattern of forbiddenPatterns) {
    for (const match of contents.matchAll(forbiddenPattern.pattern)) {
      const index = match.index ?? 0;
      if (!forbiddenPattern.shouldIgnore?.(index)) {
        const lineNumber = getLineNumber(contents, index);
        const line =
          contents.split('\n')[lineNumber - 1]?.trim().slice(0, 160) ?? '';

        matches.push({
          name: forbiddenPattern.name,
          line,
          lineNumber,
        });
      }
    }
  }

  if (matches.length > 0) {
    const details = matches
      .slice(0, 20)
      .map(
        (match) =>
          `  ${distCliPath}:${match.lineNumber} ${match.name}: ${match.line}`,
      )
      .join('\n');
    const suffix =
      matches.length > 20
        ? `\n  ...and ${matches.length - 20} more match(es).`
        : '';

    throw new TypeError(
      `Deprecated Buffer constructor usage found in CLI bundle:\n${details}${suffix}`,
    );
  }
}

assertNoDeprecatedBufferConstructors();
