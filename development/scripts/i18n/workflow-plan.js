const fs = require('node:fs');
const path = require('node:path');

const { translationRecords } = require('./workflow-client');
const {
  ROOT,
  digest,
  loadCatalog,
  normalizeDraft,
  mapLanguages,
  assertHashes,
  generatedHashes,
  writeJson,
  readJson,
  validateTranslations,
  workflowMode,
} = require('./workflow-data');
const { renderReviewHtml } = require('./workflow-review-html');
const {
  git,
  workspace,
  assertGeneratedClean,
  assertGeneratedBaseline,
} = require('./workflow-sync');

function assertPlanMode(plan) {
  if (!plan.mode)
    throw new Error('Plan has no operation mode; regenerate the preview.');
  workflowMode(plan.mode);
  if (plan.mode === 'complete') {
    for (const entry of plan.entries) {
      if (
        entry.keyId &&
        (!entry.before ||
          plan.locales.some(
            (locale) =>
              typeof entry.before[locale]?.value !== 'string' ||
              (entry.before[locale].value.trim() &&
                entry.before[locale].value !== entry.translations[locale]),
          ))
      )
        throw new Error(
          `${entry.key}: complete mode cannot overwrite non-empty translations. Use --mode update and generate a new preview.`,
        );
    }
  }
}

async function preparePlan({
  draft,
  client,
  projectName,
  root = ROOT,
  mode: requestedMode,
}) {
  if (!projectName)
    throw new Error(
      'Pass --project-name with the intended Lokalise project name. Inspect it with the project command first.',
    );
  const catalog = loadCatalog(root);
  const mode = workflowMode(requestedMode ?? draft.mode);
  const entries = normalizeDraft(draft, catalog);
  const base = workspace(root);
  assertGeneratedBaseline(root, draft.sync);
  assertHashes(root, draft.sourceFiles || {}, 'Source');
  const project = await client.project(projectName);
  if (
    draft.sync &&
    (draft.sync.project.id !== project.id ||
      draft.sync.project.name !== project.name)
  )
    throw new Error('Preview project differs from the initial pull.');
  const localeMap = mapLanguages(
    catalog.locales,
    project.languages,
    draft.localeMap,
  );
  if (draft.sync && digest(localeMap) !== digest(draft.sync.localeMap))
    throw new Error('Language mapping differs from the initial pull.');
  const changes = [];
  for (const entry of entries) {
    const remote = await client.findKey(entry.key);
    if (
      !remote &&
      !/^[a-z][a-z0-9_]*__(title|action|desc|msg)$/.test(entry.key)
    )
      throw new Error(
        `${entry.key}: a new key must use semantic_key__title/action/desc/msg.`,
      );
    if (!remote && Object.hasOwn(catalog.values.en_US, entry.localKey))
      throw new Error(
        `${entry.key} exists locally but not in the verified project. Resolve the project/key mismatch first.`,
      );
    const before = translationRecords(remote, localeMap);
    const translations = { ...entry.translations };
    for (const locale of entry.preserveRemoteLocales) {
      if (before?.[locale].value.trim())
        translations[locale] = before[locale].value;
    }
    assertPlanMode({
      mode,
      locales: catalog.locales,
      entries: [
        { ...entry, keyId: remote?.key_id || null, before, translations },
      ],
    });
    if (draft.sync && before) {
      for (const locale of catalog.locales) {
        const original = catalog.values[locale][entry.localKey] ?? '';
        if (
          before[locale].value !== original &&
          before[locale].value !== translations[locale]
        )
          throw new Error(
            `${entry.key}/${locale}: remote text changed since initial pull. Refresh the task baseline before proposing an overwrite.`,
          );
      }
    }
    validateTranslations(entry.key, translations, catalog.locales);
    changes.push({
      ...entry,
      translations,
      keyId: remote?.key_id || null,
      before,
      changedLocales: catalog.locales.filter(
        (locale) => before?.[locale].value !== translations[locale],
      ),
    });
  }
  const plan = {
    schemaVersion: 1,
    kind: 'i18n-plan',
    mode,
    createdAt: new Date().toISOString(),
    project: { id: project.id, name: project.name },
    localeMap,
    locales: catalog.locales,
    workspace: base,
    ...(draft.sync ? { sync: draft.sync } : {}),
    sourceFiles: draft.sourceFiles || {},
    ...(draft.review
      ? { review: { baseApproval: draft.review.baseApproval } }
      : {}),
    generatedFiles: generatedHashes(root),
    ignored: draft.entries
      .filter((entry) => entry.action === 'ignore')
      .map((entry) => ({
        text: entry.text,
        reason: entry.reason,
        sources: entry.sources,
      })),
    unresolved: draft.unresolved || [],
    entries: changes,
  };
  plan.approval = digest(plan);
  return plan;
}

function readPlan(file, approval) {
  const plan = readJson(file);
  const { approval: stored, ...content } = plan;
  if (
    plan.kind !== 'i18n-plan' ||
    plan.schemaVersion !== 1 ||
    stored !== digest(content)
  )
    throw new Error(
      'Plan contents changed or are invalid; regenerate the preview.',
    );
  if (approval !== undefined && approval !== stored)
    throw new Error('Approval must match the exact preview hash.');
  assertPlanMode(plan);
  return plan;
}

function cell(value) {
  return String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>');
}

function renderPreview(plan) {
  const lines = [
    '# i18n 变更预览',
    '',
    `项目：${cell(plan.project.name)}（${cell(plan.project.id)}）`,
    `模式：${plan.mode === 'complete' ? '补全（新增 key、填补空译文；保留已有非空译文）' : '更新（upsert：创建或更新）'}`,
    `范围：${plan.entries.length} 个 key，完整校验 ${plan.locales.length} 种语言。这里只展示英文和简体中文；其余翻译保存在方案 JSON 中。`,
    '',
    '| Key | 文案 |',
    '| --- | --- |',
  ];
  if (plan.sync)
    lines.splice(
      6,
      0,
      `已在任务开始时拉取远端译文；准备阶段同步涉及 ${plan.sync.changes.length} 处 key/语言变更，详情见方案记录。`,
      '',
    );
  for (const entry of plan.entries) {
    const display = (locale) =>
      entry.before && entry.before[locale].value !== entry.translations[locale]
        ? `原：${cell(entry.before[locale].value)}<br>新：${cell(entry.translations[locale])}`
        : cell(entry.translations[locale]);
    lines.push(
      `| ${cell(entry.key)} | ${display('en_US')} |`,
      `| | ${display('zh_CN')} |`,
    );
  }
  lines.push('', '## 变更与代码位置', '');
  for (const entry of plan.entries)
    lines.push(
      `- ${entry.key}（${entry.keyId ? '已有 key' : '新增 key'}）: ${(entry.sources || []).map((source) => `${source.file}:${source.line}`).join(', ') || '命令行输入'}；变更 ${entry.changedLocales.length} 种语言。`,
    );
  if (plan.ignored.length) {
    lines.push('', '## 排除项', '');
    for (const item of plan.ignored)
      lines.push(`- ${cell(item.text)}：${cell(item.reason)}`);
  }
  if (plan.unresolved.length)
    lines.push(
      '',
      `人工核对了 ${plan.unresolved.length} 处动态引用；详情见方案 JSON。`,
    );
  lines.push(
    '',
    '## 确认',
    '',
    '请确认上述中文、英文及变更范围。确认后才执行上传、重新拉取和逐语言核验。',
    '',
    `方案标识：\`${plan.approval}\``,
    '',
  );
  return lines.join('\n');
}

function savePlan(plan, file) {
  const preview = `${file.replace(/\.json$/, '')}.md`;
  const html = `${file.replace(/\.json$/, '')}.html`;
  if ([file, preview, html].some((target) => fs.existsSync(target)))
    throw new Error(
      'Plan file already exists; use a new filename to preserve approval and receipts.',
    );
  const renderedHtml = renderReviewHtml(plan, {
    planFile: path.relative(ROOT, path.resolve(file)),
  });
  writeJson(file, plan);
  fs.writeFileSync(preview, renderPreview(plan));
  fs.writeFileSync(html, renderedHtml);
  return {
    plan: path.resolve(file),
    preview: path.resolve(preview),
    html: path.resolve(html),
    approval: plan.approval,
    mode: plan.mode,
    keys: plan.entries.length,
    locales: plan.locales.length,
  };
}

module.exports = {
  preparePlan,
  readPlan,
  renderPreview,
  savePlan,
  git,
  workspace,
  assertGeneratedClean,
  assertPlanMode,
};
