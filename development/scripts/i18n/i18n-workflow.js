#!/usr/bin/env node

// cspell:ignore oenv

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const {
  applyPlan,
  verifyLocal,
  verifyRemote,
  verifyProject,
} = require('./workflow-apply');
const { LokaliseClient } = require('./workflow-client');
const {
  ROOT,
  readJson,
  loadCatalog,
  workflowMode,
} = require('./workflow-data');
const {
  compactDraft,
  saveDraft,
  fillDraft,
  singleDraft,
} = require('./workflow-draft');
const { preparePlan, readPlan, savePlan } = require('./workflow-plan');
const { createReviewedDraft, parseFeedback } = require('./workflow-review');
const { saveReviewHtml } = require('./workflow-review-html');
const { scanModule } = require('./workflow-scan');
const { readSync, syncWorkspace } = require('./workflow-sync');

const HELP = `i18n workflow (paths are relative to the repository root)
  sync --project-name <expected name> --out <sync.json> [--sync <previous.json> | --verify-current] [--locale-map <map.json>]
  scan [--mode <complete|update>] --sync <sync.json> --module <directory/file> [--module <more>] --out <draft.json>
  inspect --file <draft.json>
  fill --file <draft.json> --translations <patch.json>
  review --file <plan.json> --out <preview.html> [--feedback <revision.json>]
  review-import --file <plan.json> --feedback <copied-prompt.txt> --out <revised-draft.json> [--baseline <fresh-scanned-draft.json>]
  project
  preview --file <draft.json> [--mode <complete|update>] --project-name <expected name> --out <plan.json>
  apply --file <plan.json> --approve <confirmed preview hash>
  verify --file <plan.json>

Start each task with sync to pull the latest catalog, then scan and translate.
Default mode complete creates missing keys and fills empty translations only.
Mode update supports upsert, including edits to existing non-empty translations.
The preview binds the mode; apply cannot override it.
Scan/inspect/fill/review/review-import are offline.
Preview reads Lokalise and generates Markdown plus editable HTML automatically.
HTML shows EN/ZH initially; every other language can be expanded and edited/commented.
Apply uploads every repository locale, pulls generated files, and verifies them.
Use yarn op/keychain/oenv to supply credentials for remote commands.
Review the bilingual preview and get user confirmation before apply.`;

function options(args) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      module: { type: 'string', multiple: true },
      file: { type: 'string' },
      out: { type: 'string' },
      'project-name': { type: 'string' },
      approve: { type: 'string' },
      translations: { type: 'string' },
      feedback: { type: 'string' },
      baseline: { type: 'string' },
      apply: { type: 'string' },
      sync: { type: 'string' },
      mode: { type: 'string' },
      'locale-map': { type: 'string' },
      'include-complete': { type: 'boolean' },
      'verify-current': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
}

function requiredPath(value, option) {
  if (!value) throw new Error(`Missing --${option}.`);
  return path.resolve(ROOT, value);
}

function clientFromEnv() {
  return new LokaliseClient({
    token: process.env.LOKALISE_TOKEN,
    projectId: process.env.LOKALISE_PROJECT_ID,
  });
}

function attachSync(draft, sync) {
  if (sync) {
    draft.sync = sync;
    draft.localeMap = sync.localeMap;
  }
  return draft;
}

async function run(args = process.argv.slice(2)) {
  const { values, positionals } = options(args);
  if (values.help || !positionals.length) return HELP;
  const [command] = positionals;
  if (values['verify-current'] && command !== 'sync')
    throw new Error('--verify-current is only available for sync.');
  if (positionals.length !== 1)
    throw new Error('Unexpected positional arguments. Use --help.');
  if (values.mode && !['scan', 'preview'].includes(command))
    throw new Error(
      'Select --mode during scan or preview. Apply uses the confirmed plan mode.',
    );
  if (command === 'scan') {
    if (!values.module?.length)
      throw new Error('Pass --module for the intended code scope.');
    const sync = values.sync
      ? readSync(requiredPath(values.sync, 'sync'))
      : undefined;
    return saveDraft(
      attachSync(
        scanModule({
          modules: values.module,
          includeComplete: values['include-complete'],
          mode: values.mode,
        }),
        sync,
      ),
      requiredPath(values.out, 'out'),
    );
  }
  if (command === 'inspect')
    return compactDraft(readJson(requiredPath(values.file, 'file')));
  if (command === 'fill')
    return fillDraft(
      requiredPath(values.file, 'file'),
      requiredPath(values.translations, 'translations'),
    );
  if (['review', 'review-import'].includes(command)) {
    const file = requiredPath(values.file, 'file');
    const plan = readPlan(file);
    const receiptFile = `${file}.receipt.json`;
    const receipt = fs.existsSync(receiptFile)
      ? readJson(receiptFile)
      : undefined;
    const applied =
      receipt?.status === 'complete' && receipt.approval === plan.approval;
    if (command === 'review')
      return saveReviewHtml(plan, requiredPath(values.out, 'out'), {
        planFile: path.relative(ROOT, file),
        applied,
        ...(values.feedback
          ? {
              feedback: parseFeedback(
                fs.readFileSync(
                  requiredPath(values.feedback, 'feedback'),
                  'utf8',
                ),
              ),
            }
          : {}),
      });
    const result = createReviewedDraft(
      plan,
      parseFeedback(
        fs.readFileSync(requiredPath(values.feedback, 'feedback'), 'utf8'),
      ),
      {
        applied,
        baseline: values.baseline
          ? readJson(requiredPath(values.baseline, 'baseline'))
          : undefined,
      },
    );
    if (result.action !== 'revise-draft') return { ...result, plan: file };
    return {
      action: result.action,
      ...saveDraft(result.draft, requiredPath(values.out, 'out')),
    };
  }
  if (!['project', 'sync', 'preview', 'apply', 'verify'].includes(command))
    throw new Error(`Unknown command: ${command}`);
  const client = clientFromEnv();
  if (command === 'sync') {
    const file = requiredPath(values.out, 'out');
    const sync = await syncWorkspace({
      client,
      file,
      projectName: values['project-name'],
      verifyCurrent: values['verify-current'],
      previousSync: values.sync
        ? readSync(requiredPath(values.sync, 'sync'))
        : undefined,
      localeMap: values['locale-map']
        ? readJson(requiredPath(values['locale-map'], 'locale-map'))
        : undefined,
    });
    return {
      sync: file,
      project: sync.project,
      changedTranslations: sync.changes.length,
      changedKeys: new Set(sync.changes.map((change) => change.key)).size,
    };
  }
  if (values.sync)
    throw new Error(
      'Attach --sync while scanning or creating a single-key draft, before translating. Preview uses the baseline already stored in the draft.',
    );
  if (command === 'project') {
    const project = await client.project();
    return {
      id: project.id,
      name: project.name,
      languages: project.languages.map(({ lang_iso, lang_name }) => ({
        lang_iso,
        lang_name,
      })),
      repositoryLocales: loadCatalog().locales,
    };
  }
  const file = requiredPath(values.file, 'file');
  if (command === 'preview') {
    const out = requiredPath(values.out, 'out');
    return savePlan(
      await preparePlan({
        draft: readJson(file),
        client,
        projectName: values['project-name'],
        mode: values.mode,
      }),
      out,
    );
  }
  if (command === 'apply') {
    const receipt = await applyPlan({ file, approval: values.approve, client });
    return {
      status: receipt.status,
      receipt: `${file}.receipt.json`,
      verifiedKeys: receipt.verification.verifiedKeys,
      locales: receipt.verification.verifiedLocales,
      unrelatedChanges: receipt.verification.unrelatedChanges,
    };
  }
  const plan = readPlan(file);
  await verifyProject(plan, client, ROOT);
  await verifyRemote(plan, client);
  return verifyLocal(plan);
}

async function runAdd(args = process.argv.slice(2)) {
  const { values, positionals } = options(args);
  if (values.help || (!positionals.length && !values.file && !values.apply))
    return `i18n:add now supports full-locale create and update through a confirmed plan.
  yarn i18n:add <key> "English" "中文" [--mode <complete|update>] [--sync <sync.json>] --out <draft.json>
    Creates an offline draft with slots for every locale; no upload.
  yarn i18n:add <key> [--mode <complete|update>] [--sync <sync.json>] --translations <locale-to-text.json> --project-name <name> --out <plan.json>
    Previews a single key in all locales; defaults to filling missing translations.
  yarn i18n:add --file <draft.json> [--mode <complete|update>] --project-name <name> --out <plan.json>
    Previews a batch; inherits the draft mode unless explicitly overridden here.
  yarn i18n:add --apply <plan.json> --approve <confirmed hash>
    Uploads all locales, pulls, and verifies.
${HELP}`;
  if (values.apply) {
    if (values.mode)
      throw new Error(
        'Apply cannot override the confirmed plan mode; generate a new preview.',
      );
    if (!values.approve)
      throw new Error('Missing confirmed preview hash: --approve.');
    return run(['apply', '--file', values.apply, '--approve', values.approve]);
  }
  if (values.file && values.sync)
    throw new Error(
      'A file draft must already contain its initial pull baseline. Rescan with --sync before translating.',
    );
  const out = requiredPath(
    values.out || `.tmp/i18n/add-${Date.now()}.json`,
    'out',
  );
  if (values.file)
    return savePlan(
      await preparePlan({
        draft: readJson(requiredPath(values.file, 'file')),
        client: clientFromEnv(),
        projectName: values['project-name'],
        mode: values.mode,
      }),
      out,
    );
  const [key, en, zh] = positionals;
  const mode = workflowMode(values.mode);
  const sync = values.sync
    ? readSync(requiredPath(values.sync, 'sync'))
    : undefined;
  if (!key || positionals.length > 3)
    throw new Error('Provide a key and optional English/Chinese text.');
  if (values.translations) {
    if (en || zh)
      throw new Error('Use either positional copy or --translations.');
    const draft = attachSync(
      singleDraft(
        key,
        readJson(requiredPath(values.translations, 'translations')),
        ROOT,
        mode,
      ),
      sync,
    );
    return savePlan(
      await preparePlan({
        draft,
        client: clientFromEnv(),
        projectName: values['project-name'],
      }),
      out,
    );
  }
  if (!en) throw new Error('English text or --translations is required.');
  return saveDraft(
    attachSync(
      singleDraft(key, { en_US: en, ...(zh ? { zh_CN: zh } : {}) }, ROOT, mode),
      sync,
    ),
    out,
  );
}

function print(result) {
  console.log(
    typeof result === 'string' ? result : JSON.stringify(result, null, 2),
  );
}

if (require.main === module)
  run()
    .then(print)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });

module.exports = { run, runAdd, print };
