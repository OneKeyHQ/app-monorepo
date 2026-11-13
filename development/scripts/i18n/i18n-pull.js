#!/usr/bin/env node

// Pull app translations from OneKeyHQ/onekey-i18n into packages/shared/src/locale.
//
//   yarn i18n:pull                    the app release (app-latest, published from
//                                     onekey-i18n main)
//   yarn i18n:pull --pr 12 [--wait]   the CI preview of an open onekey-i18n PR;
//                                     such files must not be merged into x
//
// ONEKEY_I18N_CHANNEL=test reads app-test instead, which an onekey-i18n branch
// publishes while it is being tried.
// Token: ONEKEY_I18N_TOKEN (read-only; yarn op loads it from 1Password),
// GH_TOKEN or GITHUB_TOKEN, else `gh auth token`.
// --output-root writes into another tree (workflow verification).

const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  ROOT,
  fromPullRequest,
  fromRelease,
  writeLocaleFiles,
} = require('./central');

async function run(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      pr: { type: 'string' },
      wait: { type: 'boolean' },
      'output-root': { type: 'string' },
    },
  });
  // `yarn i18n:pull` runs inside packages/shared; resolve relative paths from
  // where the command was typed.
  const root = values['output-root']
    ? path.resolve(process.env.INIT_CWD || process.cwd(), values['output-root'])
    : ROOT;
  const result = values.pr
    ? await fromPullRequest({ pr: values.pr, wait: values.wait })
    : await fromRelease();
  const count = writeLocaleFiles(root, result);
  const from =
    result.source === 'release'
      ? `${result.tag} ${result.version}`
      : `onekey-i18n PR #${result.pr}`;
  return `Pulled ${count} files from ${from} (${result.commit.slice(0, 10)}).`;
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
