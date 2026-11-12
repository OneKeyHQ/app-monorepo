#!/usr/bin/env node

// Pull app translations from OneKeyHQ/onekey-i18n into packages/shared/src/locale.
//
//   yarn i18n:pull                  latest release (uses your `gh auth login`)
//   yarn i18n:pull --tag <tag>      a specific release
//   yarn i18n:pull --from <dir>     a local onekey-i18n checkout, for copy whose PR is
//                                   not merged yet; such files cannot be merged into x
//   yarn i18n:pull --verify         check generated files against i18n.lock.json
//                                   (add --allow-local while the onekey-i18n PR is open)
//
// --output-root writes into another tree (workflow verification);
// --expected-project-id rejects workflow plans made for another source.

const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  PROJECT_ID,
  ROOT,
  fromCheckout,
  fromRelease,
  verifyLock,
  writeLocaleFiles,
} = require('./central');

function run(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      tag: { type: 'string' },
      from: { type: 'string' },
      'output-root': { type: 'string' },
      'expected-project-id': { type: 'string' },
      verify: { type: 'boolean' },
      'allow-local': { type: 'boolean' },
    },
  });
  if (
    values['expected-project-id'] !== undefined &&
    values['expected-project-id'] !== PROJECT_ID
  )
    throw new Error(
      `This pull serves ${PROJECT_ID}, not ${values['expected-project-id']}. Start a new sync.`,
    );
  // `yarn i18n:pull` runs inside packages/shared; resolve relative paths from
  // where the command was typed.
  const base = process.env.INIT_CWD || process.cwd();
  const root = values['output-root']
    ? path.resolve(base, values['output-root'])
    : ROOT;
  if (values.verify) {
    const lock = verifyLock(root, { allowLocal: values['allow-local'] });
    return `Locale files match ${lock.source === 'release' ? lock.tag : `local ${lock.commit}`}.`;
  }
  if (values.tag && values.from)
    throw new Error('Choose either --tag or --from.');
  const result = values.from
    ? fromCheckout(path.resolve(base, values.from))
    : fromRelease({ tag: values.tag });
  const lock = writeLocaleFiles(root, result);
  return `Pulled ${lock.files.length} files from ${
    lock.source === 'release'
      ? lock.tag
      : `local checkout ${lock.commit.slice(0, 10)}${lock.dirty ? ' (uncommitted changes)' : ''}`
  }.`;
}

if (require.main === module) {
  try {
    console.log(run());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { run };
