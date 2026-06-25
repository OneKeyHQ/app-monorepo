const fs = require('fs');
const path = require('path');

const { enabledTargets } = require('./targets.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const lavamoatRoot = path.join(repoRoot, 'lavamoat');

function sortObject(value) {
  if (Array.isArray(value)) {
    const items = value.map(sortObject);
    if (items.every((item) => typeof item === 'string')) {
      return items.sort((left, right) => left.localeCompare(right));
    }
    return items;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}

function normalizeJsonFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  const normalized = `${JSON.stringify(
    sortObject(JSON.parse(original)),
    null,
    2,
  )}\n`;

  if (original !== normalized) {
    fs.writeFileSync(file, normalized);
    return true;
  }

  return false;
}

const files = enabledTargets.flatMap((target) => [
  path.join(lavamoatRoot, target.policy),
  path.join(lavamoatRoot, target.override),
]);
const missingFiles = files.filter((file) => !fs.existsSync(file));

if (missingFiles.length > 0) {
  throw new Error(
    `Missing enabled LavaMoat policy artifacts:\n${missingFiles
      .map((file) => path.relative(repoRoot, file))
      .join('\n')}`,
  );
}

const changedFiles = files.filter(normalizeJsonFile);

console.log(
  `Normalized ${files.length} LavaMoat policy artifacts${
    changedFiles.length > 0 ? ` (${changedFiles.length} changed)` : ''
  }.`,
);
