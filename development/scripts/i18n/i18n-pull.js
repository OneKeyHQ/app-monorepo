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
  LOCALE_ROOT,
  ROOT,
  fromPullRequest,
  fromRelease,
  githubApi,
  writeLocaleFiles,
} = require('./central');

async function run(
  args = process.argv.slice(2),
  { api = githubApi(), log = console.log } = {},
) {
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
  const cwd = process.env.INIT_CWD || process.cwd();
  const root = values['output-root']
    ? path.resolve(cwd, values['output-root'])
    : ROOT;
  // Said first, so a failed download still shows which credentials it used.
  const { source, login } = await api.identity();
  log(`GitHub access: ${source}${login ? `, GitHub user ${login}` : ''}`);
  const result = values.pr
    ? await fromPullRequest({ pr: values.pr, wait: values.wait, api })
    : await fromRelease({ api });
  const commit = result.commit.slice(0, 10);
  log(
    result.source === 'release'
      ? `Release: ${result.url} (${result.tag} ${result.version}, commit ${commit})`
      : `Preview: ${result.url}, CI run ${result.runUrl} (commit ${commit})`,
  );
  const count = writeLocaleFiles(root, result);
  const target = path.join(root, LOCALE_ROOT);
  // Relative to the repository root: under yarn workspace the cwd is packages/shared.
  const shown = target.startsWith(`${ROOT}${path.sep}`)
    ? path.relative(ROOT, target)
    : target;
  log(`Pulled ${count} files into ${shown}.`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
