#!/usr/bin/env node

// Pull app translations from OneKeyHQ/onekey-i18n into packages/shared/src/locale.
//
//   yarn i18n:pull                         latest release (app-latest)
//   yarn i18n:pull --version 2026.11.12.1  a specific release (app-2026.11.12.1)
//   yarn i18n:pull --pr 12 [--wait]        the CI preview of an open onekey-i18n PR;
//                                          such files cannot be merged into x
//   yarn i18n:check-lock                   check generated files against i18n.lock.json
//                                          (--allow-preview while the onekey-i18n PR is open)
//
// Token: ONEKEY_I18N_TOKEN, GH_TOKEN or GITHUB_TOKEN, else `gh auth token`.
// --output-root writes into another tree (workflow verification);
// --expected-project-id rejects workflow plans made for another source.

const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  PROJECT_ID,
  ROOT,
  fromPullRequest,
  fromRelease,
  verifyLock,
  writeLocaleFiles,
} = require('./central');

async function run(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      version: { type: 'string' },
      pr: { type: 'string' },
      wait: { type: 'boolean' },
      'output-root': { type: 'string' },
      'expected-project-id': { type: 'string' },
      verify: { type: 'boolean' },
      'allow-preview': { type: 'boolean' },
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
  const root = values['output-root']
    ? path.resolve(process.env.INIT_CWD || process.cwd(), values['output-root'])
    : ROOT;
  if (values.verify) {
    const lock = verifyLock(root, { allowPreview: values['allow-preview'] });
    return `Locale files match ${lock.source === 'release' ? lock.tag : `onekey-i18n PR #${lock.pr}`}.`;
  }
  if (values.version && values.pr)
    throw new Error('Choose either --version or --pr.');
  const result = values.pr
    ? await fromPullRequest({ pr: values.pr, wait: values.wait })
    : await fromRelease({ version: values.version });
  const lock = writeLocaleFiles(root, result);
  return `Pulled ${lock.files.length} files from ${
    lock.source === 'release'
      ? lock.tag
      : `onekey-i18n PR #${lock.pr} (${lock.commit.slice(0, 10)})`
  }.`;
}

if (require.main === module) {
  run()
    .then((message) => console.log(message))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { run };
