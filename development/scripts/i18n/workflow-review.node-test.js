const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { JSDOM, VirtualConsole } = require('jsdom');

const { loadCatalog, normalizeDraft, writeJson } = require('./workflow-data');
const { fillDraft } = require('./workflow-draft');
const { preparePlan, savePlan } = require('./workflow-plan');
const { parseFeedback, createReviewedDraft } = require('./workflow-review');
const { renderReviewHtml } = require('./workflow-review-html');
const { fixture, fakeClient } = require('./workflow-test-fixture');

async function prepared(t, options = {}) {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const draft = ctx.draft();
  if (options.existing) {
    draft.entries[0].key = 'global.existing';
    draft.entries[0].translations = ctx.old;
  }
  if (options.mode) draft.mode = options.mode;
  const plan = await preparePlan({
    draft,
    client: api.client,
    root: ctx.root,
    projectName: 'Monorepo test',
  });
  return { ...ctx, ...api, plan };
}

function browser(t, plan, options = {}) {
  const html = renderReviewHtml(plan, {
    planFile: '.tmp/i18n/plan.json',
    ...options,
  });
  const runtimeErrors = [];
  const animationFrames = [];
  const scrollCalls = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => runtimeErrors.push(error.message));
  const dom = new JSDOM(html, {
    virtualConsole,
    url: 'https://preview.example.invalid/',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
      window.HTMLDialogElement.prototype.close = function close() {
        this.open = false;
      };
      window.Element.prototype.scrollIntoView = function scrollIntoView(
        settings,
      ) {
        scrollCalls.push({ element: this, settings });
      };
      window.requestAnimationFrame = (callback) =>
        animationFrames.push(callback);
      window.matchMedia = () => ({ matches: window.innerWidth <= 640 });
      options.prepareWindow?.(window);
    },
  });
  t.after(async () => {
    // Native details toggle events are queued; flush them before destroying the window.
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.window.close();
    assert.deepEqual(
      runtimeErrors,
      [],
      'Standalone preview must not throw runtime errors',
    );
  });
  const document = dom.window.document;
  return {
    document,
    html,
    scrollCalls,
    flushAnimationFrame() {
      animationFrames.splice(0).forEach((callback) => callback(0));
    },
    edit(selector, value) {
      const element = document.querySelector(selector);
      assert(element, selector);
      element.value = value;
      element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    },
    click(selector) {
      document.querySelector(selector).click();
    },
    feedback() {
      document.getElementById('generate').click();
      return parseFeedback(document.getElementById('prompt').value);
    },
  };
}

test('plan saving automatically produces standalone HTML and every other language can expand globally or per key', async (t) => {
  const ctx = await prepared(t);
  const file = path.join(ctx.root, 'plan.json');
  const saved = savePlan(ctx.plan, file);
  assert(fs.existsSync(saved.html));
  assert(fs.existsSync(saved.preview));
  const page = browser(t, ctx.plan);
  const groups = [...page.document.querySelectorAll('.other-locales')];
  assert(groups.every((element) => !element.open));
  assert.equal(page.document.querySelectorAll('.translation').length, 19);
  groups[0].open = true;
  assert.equal(groups[0].open, true);
  page.click('#toggle-all');
  assert(groups.every((element) => !element.open));
  assert.equal(
    page.document.getElementById('toggle-all').getAttribute('aria-pressed'),
    'false',
  );
  page.click('#toggle-all');
  assert(groups.every((element) => element.open));
  assert.equal(
    page.document.getElementById('toggle-all').textContent,
    '折叠其他语言',
  );
  assert(!page.html.includes('src="http'));
  assert.equal(ctx.writes.length, 0);
});

test('edited keys retain the original identity and full-language edits/comments survive prompt import', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const originalKey = ctx.plan.entries[0].key;
  page.edit('.key-input', 'travel_mode_screen__title');
  page.edit('#translation-0-en_US', 'Travel protection');
  page.edit('#translation-0-zh_CN', '旅行保护');
  page.edit('#translation-0-de', 'Reiseschutz');
  page.edit('.key-side .note textarea', 'Key 应体现设置页面。');
  page.edit(
    '[aria-label="travel_mode__title zh_CN 的译文评论"]',
    '这个说法是否会让用户误解？',
  );
  page.edit(
    '[aria-label="travel_mode__title fr_FR 的译文评论"]',
    '语气更自然一些。',
  );
  const feedback = page.feedback();
  assert.equal(feedback.intent, 'revise');
  assert.equal(feedback.changes[0].key, originalKey);
  assert.equal(feedback.changes[0].newKey, 'travel_mode_screen__title');
  const prompt = page.document.getElementById('prompt').value;
  assert(prompt.includes(`原 key：${originalKey}`));
  assert(prompt.includes('新 key：travel_mode_screen__title'));
  const result = createReviewedDraft(ctx.plan, feedback);
  const entry = result.draft.entries[0];
  assert.equal(entry.key, 'travel_mode_screen__title');
  assert.equal(entry.translations.de, 'Reiseschutz');
  assert.equal(entry.translations.zh_CN, '旅行保护');
  assert.equal(entry.translations.fr_FR, null);
  assert.equal(entry.translationReviewNotes.fr_FR, '语气更自然一些。');
  assert.equal(entry.reviewNote, 'Key 应体现设置页面。');
  assert.equal(result.draft.reviewNotesReviewed, false);
  assert.throws(
    () => normalizeDraft(result.draft, loadCatalog(ctx.root)),
    /Resolve review comments/,
  );
  assert.equal(ctx.writes.length, 0);
});

test('prefilled revisions preserve original keys, isolate older browser drafts and still request revision instead of upload', async (t) => {
  const ctx = await prepared(t);
  const feedback = {
    schemaVersion: 1,
    kind: 'i18n-review',
    baseApproval: ctx.plan.approval,
    mode: ctx.plan.mode,
    intent: 'revise',
    changes: [
      { key: ctx.plan.entries[0].key, newKey: 'travel_mode__screen__title' },
    ],
  };
  const page = browser(t, ctx.plan, {
    feedback,
    applied: true,
    prepareWindow(window) {
      window.localStorage.setItem(
        `onekey-i18n-review:${ctx.plan.approval}`,
        JSON.stringify({
          approval: ctx.plan.approval,
          mode: ctx.plan.mode,
          entries: [
            {
              key: 'older_browser_draft__title',
              translations: ctx.plan.entries[0].translations,
              note: '',
              translationNotes: {},
            },
          ],
        }),
      );
    },
  });
  const { document } = page;
  assert.equal(
    document.querySelector('.key-input').value,
    feedback.changes[0].newKey,
  );
  assert(document.querySelector('.key-input').classList.contains('modified'));
  assert(document.querySelector('.nav-key').classList.contains('modified'));
  assert.equal(
    document.getElementById('translation-0-en_US').value,
    'Travel Mode',
  );
  assert.equal(document.getElementById('plan-state').textContent, '待确认修订');
  assert.equal(page.feedback().intent, 'revise');
  assert.equal(page.feedback().changes[0].key, ctx.plan.entries[0].key);
  assert.equal(page.feedback().changes[0].newKey, feedback.changes[0].newKey);
  assert(
    createReviewedDraft(ctx.plan, page.feedback(), { applied: true }).draft
      .review.requiresRefresh,
  );
  const refreshedSources = [{ file: 'module/copy.ts', line: 42 }];
  const refreshed = createReviewedDraft(ctx.plan, page.feedback(), {
    applied: true,
    baseline: {
      kind: 'i18n-draft',
      sync: { project: ctx.plan.project },
      references: [{ key: ctx.plan.entries[0].key, sources: refreshedSources }],
      sourceFiles: ctx.plan.sourceFiles,
    },
  });
  assert.deepEqual(refreshed.draft.entries[0].sources, refreshedSources);
  assert.equal(refreshed.draft.review.requiresRefresh, false);
  page.click('#close-dialog');
  page.click('.reset-button');
  page.click('#confirm-reset');
  assert.equal(
    document.querySelector('.key-input').value,
    ctx.plan.entries[0].key,
  );
  assert(!document.querySelector('.nav-key').classList.contains('modified'));
  assert.equal(
    createReviewedDraft(ctx.plan, page.feedback(), { applied: true }).action,
    'already-applied',
  );
  assert.throws(
    () =>
      renderReviewHtml(ctx.plan, {
        feedback: { ...feedback, baseApproval: 'stale' },
      }),
    /another preview/,
  );
  assert.equal(ctx.writes.length, 0);
});

test('comment-only feedback requires model resolution and creates a fresh HTML for second confirmation', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  page.edit(
    '[aria-label="travel_mode__title zh_CN 的译文评论"]',
    '请强调模式的用途。',
  );
  const result = createReviewedDraft(ctx.plan, page.feedback());
  assert.equal(result.action, 'revise-draft');
  const file = path.join(ctx.root, 'reviewed.json');
  const patch = path.join(ctx.root, 'patch.json');
  writeJson(file, result.draft);
  writeJson(patch, {
    reviewNotesReviewed: true,
    entries: [
      {
        key: 'travel_mode__title',
        translations: { zh_CN: '旅行隐私模式' },
        reviewResponse: '中文补充隐私用途；英文含义未变，其他语言保留。',
      },
    ],
  });
  fillDraft(file, patch, ctx.root);
  const next = await preparePlan({
    draft: JSON.parse(fs.readFileSync(file)),
    client: ctx.client,
    root: ctx.root,
    projectName: 'Monorepo test',
  });
  assert.notEqual(next.approval, ctx.plan.approval);
  assert.equal(next.review.baseApproval, ctx.plan.approval);
  const nextPage = browser(t, next);
  assert.equal(
    nextPage.document.getElementById('translation-0-zh_CN').value,
    '旅行隐私模式',
  );
  assert.match(
    nextPage.document.body.textContent,
    /本轮处理说明：中文补充隐私用途/,
  );
  assert.equal(nextPage.feedback().baseApproval, next.approval);
  assert.equal(ctx.writes.length, 0);
});

test('source edits made while resolving a comment invalidate untouched translations', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  page.edit('.key-side .note textarea', '改得更准确。');
  const result = createReviewedDraft(ctx.plan, page.feedback());
  const file = path.join(ctx.root, 'reviewed.json');
  const patch = path.join(ctx.root, 'patch.json');
  writeJson(file, result.draft);
  writeJson(patch, {
    entries: [
      {
        key: 'travel_mode__title',
        translations: { en_US: 'Travel protection' },
      },
    ],
  });
  fillDraft(file, patch, ctx.root);
  const draft = JSON.parse(fs.readFileSync(file));
  assert(
    ctx.locales
      .filter((locale) => locale !== 'en_US')
      .every((locale) => draft.entries[0].translations[locale] === null),
  );
});

test('completion restrictions, stale feedback, unknown languages and duplicate identities fail before writes', async (t) => {
  const ctx = await prepared(t, { existing: true, mode: 'complete' });
  const page = browser(t, ctx.plan);
  const approved = page.feedback();
  assert.equal(createReviewedDraft(ctx.plan, approved).action, 'approve-plan');
  assert.equal(
    createReviewedDraft(ctx.plan, approved, { applied: true }).action,
    'already-applied',
  );
  page.click('#close-dialog');
  page.edit('#translation-0-zh_CN', '新的译文');
  page.click('#generate');
  assert.equal(page.document.getElementById('prompt-dialog').open, false);
  assert.match(page.document.querySelector('.entry-error').textContent, /更新/);
  const changed = {
    ...approved,
    intent: 'revise',
    changes: [{ key: 'global.existing', translations: { zh_CN: '新的译文' } }],
  };
  assert.throws(() => createReviewedDraft(ctx.plan, changed), /complete mode/);
  changed.mode = 'update';
  assert.equal(createReviewedDraft(ctx.plan, changed).action, 'revise-draft');
  assert.throws(
    () => createReviewedDraft(ctx.plan, { ...changed, baseApproval: 'wrong' }),
    /another preview/,
  );
  assert.throws(
    () =>
      createReviewedDraft(ctx.plan, {
        ...changed,
        changes: [...changed.changes, ...changed.changes],
      }),
    /duplicate/,
  );
  assert.throws(
    () =>
      createReviewedDraft(ctx.plan, {
        ...changed,
        changes: [{ key: 'unknown' }],
      }),
    /unknown/,
  );
  assert.throws(
    () =>
      createReviewedDraft(ctx.plan, {
        ...changed,
        changes: [{ key: 'global.existing', translations: { typo: 'Text' } }],
      }),
    /Invalid edited translation/,
  );
  assert.throws(
    () => createReviewedDraft(ctx.plan, { ...changed, intent: 'approve' }),
    /cannot approve/,
  );
  const historical = createReviewedDraft(ctx.plan, changed, { applied: true });
  assert.equal(historical.draft.review.requiresRefresh, true);
  assert.throws(
    () => normalizeDraft(historical.draft, loadCatalog(ctx.root)),
    /Refresh sync/,
  );
  assert.equal(ctx.writes.length, 0);
});

test('HTML safely renders script-like translation text and reset removes edits and comments', async (t) => {
  const ctx = await prepared(t);
  const text =
    '</script><script>window.reviewInjected=true</script> & <b>Text</b> /* REVIEW_SCRIPT */';
  ctx.plan.entries[0].translations.zh_CN = text;
  const page = browser(t, ctx.plan);
  assert.equal(page.document.defaultView.reviewInjected, undefined);
  assert.equal(page.document.getElementById('translation-0-zh_CN').value, text);
  page.edit('#translation-0-en_US', 'Edited');
  page.edit('.key-side .note textarea', 'Comment');
  page.click('.key-side button');
  assert.equal(page.document.getElementById('reset-dialog').open, true);
  assert.equal(page.document.activeElement.id, 'cancel-reset');
  assert.equal(
    page.document.getElementById('translation-0-en_US').value,
    'Edited',
  );
  page.click('#confirm-reset');
  assert.equal(
    page.document.getElementById('translation-0-en_US').value,
    'Travel Mode',
  );
  assert.equal(
    page.document.querySelector('.key-side .note textarea').value,
    '',
  );
  assert.equal(page.feedback().intent, 'approve');
});

test('cancelling restore or pressing Escape preserves edits and comments', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  page.edit('.key-input', 'travel_mode_screen__title');
  page.edit('#translation-0-de', 'Neue Übersetzung');
  page.edit('.key-side .note textarea', 'Keep this comment');
  page.edit(
    '[aria-label="travel_mode__title zh_CN 的译文评论"]',
    'Keep this translation comment',
  );
  const before = page.feedback();
  page.click('#close-dialog');

  page.click('.key-side button');
  page.click('#cancel-reset');
  assert.equal(page.document.getElementById('reset-dialog').open, false);
  assert.deepEqual(page.feedback(), before);
  page.click('#close-dialog');

  page.click('.key-side button');
  const dialog = page.document.getElementById('reset-dialog');
  dialog.dispatchEvent(new page.document.defaultView.Event('cancel'));
  dialog.close();
  page.click('#confirm-reset');
  assert.deepEqual(page.feedback(), before);
});

function addSecondEntry(plan) {
  const first = plan.entries[0];
  plan.entries.push({
    ...first,
    key: 'travel_mode__desc',
    translations: {
      ...first.translations,
      en_US: 'Protect your privacy',
      zh_CN: '保护隐私',
      de: 'Privatsphäre schützen',
    },
  });
}

test('all entries stay visible while directory, pager and keyboard navigation scroll to distinct titled sections', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  const visible = () =>
    [...page.document.querySelectorAll('.entry')]
      .filter((entry) => !entry.hidden)
      .map((entry) => entry.dataset.index);
  assert.deepEqual(visible(), ['0', '1']);
  assert.equal(
    page.scrollCalls.length,
    0,
    'Opening the preview must not jump past its directory',
  );
  assert.deepEqual(
    [...page.document.querySelectorAll('.entry-title')].map(
      (title) => title.textContent,
    ),
    ['Travel Mode', 'Protect your privacy'],
  );
  assert.deepEqual(
    [...page.document.querySelectorAll('.entry-head .number')].map(
      (title) => title.textContent,
    ),
    ['01', '02'],
  );
  assert.equal(page.document.getElementById('previous-entry').disabled, true);
  page.edit('#translation-0-zh_CN', '旅途模式');
  page.click('#next-entry');
  assert.deepEqual(visible(), ['0', '1']);
  assert.equal(page.scrollCalls.at(-1).element.id, 'entry-1');
  assert.equal(page.scrollCalls.at(-1).settings.block, 'start');
  assert.equal(page.document.getElementById('next-entry').disabled, true);
  page.click('#previous-entry');
  assert.equal(
    page.document.getElementById('translation-0-zh_CN').value,
    '旅途模式',
  );
  const first = page.document.querySelector('.nav-entry');
  first.dispatchEvent(
    new page.document.defaultView.KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
    }),
  );
  assert.deepEqual(visible(), ['0', '1']);
  assert.equal(page.scrollCalls.at(-1).element.id, 'entry-1');
  assert.equal(page.document.activeElement.dataset.index, '1');
  assert.equal(
    page.document.querySelectorAll('.nav-entry[aria-current="true"]').length,
    1,
  );
  page.click('.nav-entry[data-index="0"]');
  assert.deepEqual(visible(), ['0', '1']);
  assert.equal(page.scrollCalls.at(-1).element.id, 'entry-0');
  assert.equal(page.feedback().changes.length, 1);
});

test('one toggle handles all, partial and collapsed language states across entries', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  const groups = [...page.document.querySelectorAll('.other-locales')];
  const toggle = page.document.getElementById('toggle-all');
  assert.equal(toggle.textContent, '展开全部语言');
  groups[0].open = true;
  groups[0].dispatchEvent(new page.document.defaultView.Event('toggle'));
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  page.click('#toggle-all');
  assert(groups.every((group) => group.open));
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  groups[1].open = false;
  groups[1].dispatchEvent(new page.document.defaultView.Event('toggle'));
  assert.equal(toggle.textContent, '展开全部语言');
  page.click('#toggle-all');
  page.click('#toggle-all');
  assert(groups.every((group) => !group.open));
  assert.equal(toggle.textContent, '展开全部语言');
});

test('one click opens and focuses both entry and translation comments', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  for (const selector of [
    '.key-side .comment-toggle',
    '.bilingual .comment-toggle',
  ]) {
    const trigger = page.document.querySelector(selector);
    const panel = page.document.getElementById(
      trigger.getAttribute('aria-controls'),
    );
    assert.equal(panel.hidden, true);
    page.click(selector);
    assert.equal(panel.hidden, false);
    assert.equal(page.document.activeElement, panel.querySelector('textarea'));
    page.edit(`#${panel.id} textarea`, '请再想想措辞');
    assert.equal(panel.hidden, false);
    assert(trigger.classList.contains('has-comment'));
    assert.equal(trigger.textContent, '评论');
  }
  assert.match(
    page.document.getElementById('change-count').textContent,
    /2 条评论/,
  );
  assert.equal(page.feedback().changes[0].note, '请再想想措辞');
  assert.equal(
    page.feedback().changes[0].translationNotes.en_US,
    '请再想想措辞',
  );
});

test('search locates foreign text and comments, expands matches and restores language folding on clear', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  page.edit('#search', 'Privatsphäre');
  const entry = page.document.querySelector('.entry[data-index="1"]');
  assert.equal(entry.hidden, false);
  assert.equal(entry.querySelector('.other-locales').open, true);
  assert(
    entry
      .querySelector('#translation-1-de')
      .closest('.translation')
      .classList.contains('search-match'),
  );
  assert.equal(
    page.document.querySelector('.entry[data-index="0"]').hidden,
    true,
  );
  page.edit('#search', '');
  assert.equal(entry.querySelector('.other-locales').open, false);
  page.edit(
    '[aria-label="travel_mode__title fr_FR 的译文评论"]',
    '法语有个特殊用词',
  );
  page.edit('#search', '特殊用词');
  const comment = page.document.querySelector(
    '[aria-label="travel_mode__title fr_FR 的译文评论"]',
  );
  assert.equal(comment.closest('.entry').hidden, false);
  assert.equal(comment.closest('.note').hidden, false);
  assert.equal(comment.closest('.other-locales').open, true);
  page.edit('#search', 'no match anywhere');
  assert.equal(page.document.getElementById('empty').hidden, false);
  assert.equal(
    page.document.querySelectorAll('.nav-entry:not([hidden])').length,
    0,
  );
  page.click('#clear-filters');
  assert.equal(page.document.getElementById('empty').hidden, true);
  assert.equal(
    page.document.querySelectorAll('.nav-entry:not([hidden])').length,
    2,
  );
});

test('readable confirmation shows original keys and bilingual diffs with foreign edits collapsed; clipboard fallback opens and selects the prompt', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  page.edit('.key-input', 'travel_screen__title');
  page.edit('#translation-0-zh_CN', '旅行保护');
  page.edit('#translation-0-de', 'Reiseschutz');
  page.edit('[aria-label="travel_mode__title zh_CN 的译文评论"]', '请突出隐私');
  page.feedback();
  const summary = page.document.getElementById('change-summary');
  assert.match(summary.textContent, /travel_mode__title/);
  assert.match(summary.textContent, /travel_screen__title/);
  assert.match(summary.textContent, /新：旅行保护/);
  assert.match(summary.textContent, /请突出隐私/);
  assert.equal(summary.querySelector('.summary-other').open, false);
  assert.match(
    summary.querySelector('.summary-other').textContent,
    /Reiseschutz/,
  );
  assert.equal(page.document.getElementById('prompt-details').open, false);
  const prompt = page.document.getElementById('prompt');
  const editedPrompt = `${prompt.value}\n\n请保留产品名称的大小写。`;
  assert.equal(prompt.readOnly, false);
  page.edit('#prompt', editedPrompt);
  page.click('#copy');
  await Promise.resolve();
  assert.equal(page.document.getElementById('prompt-details').open, true);
  assert.equal(prompt.value, editedPrompt);
  assert.equal(page.document.activeElement, prompt);
  assert.equal(prompt.selectionStart, 0);
  assert.equal(prompt.selectionEnd, prompt.value.length);
  page.click('#back-to-edit');
  assert.equal(page.document.getElementById('prompt-dialog').open, false);
  assert.equal(
    page.document.querySelector('.key-input').value,
    'travel_screen__title',
  );
});

test('copy uses the edited prompt, reopening preserves additions and changed entries regenerate fresh feedback', async (t) => {
  const ctx = await prepared(t);
  const copied = [];
  let finishCopy;
  const page = browser(t, ctx.plan, {
    prepareWindow(window) {
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText(value) {
            copied.push(value);
            return new Promise((resolve) => {
              finishCopy = resolve;
            });
          },
        },
      });
    },
  });
  page.feedback();
  const { document } = page;
  const prompt = document.getElementById('prompt');
  const edited = `补充要求：请说明命名依据。\n\n${prompt.value}`;
  page.edit('#prompt', edited);
  page.click('#copy');
  finishCopy();
  await new Promise(setImmediate);
  assert.equal(copied[0], edited);
  assert.match(document.getElementById('copy-state').textContent, /已复制/);
  page.click('#back-to-edit');
  page.click('#generate');
  assert.equal(prompt.value, edited);
  assert.equal(document.getElementById('prompt-details').open, true);
  page.click('#copy');
  page.edit('#prompt', `${edited}\n请保留现有译文。`);
  finishCopy();
  await new Promise(setImmediate);
  assert.match(
    document.getElementById('copy-state').textContent,
    /请复制最新内容/,
  );
  page.click('#copy');
  finishCopy();
  await new Promise(setImmediate);
  assert.equal(copied.at(-1), prompt.value);
  page.click('#back-to-edit');
  page.edit('#translation-0-en_US', 'Updated Travel Mode');
  const feedback = page.feedback();
  assert.equal(feedback.changes[0].translations.en_US, 'Updated Travel Mode');
  assert(!prompt.value.includes('补充要求：'));
  assert(!prompt.classList.contains('modified'));
  assert.equal(ctx.writes.length, 0);
});

test('changed filter and restore keep navigation consistent, and invalid hidden entries are revealed before confirmation', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  page.edit('#translation-0-zh_CN', 'Modified');
  page.click('#next-entry');
  page.click('#only-changed');
  assert.equal(
    page.document.querySelector('.entry[data-index="0"]').hidden,
    false,
  );
  assert.equal(
    page.document.querySelector('.nav-entry[data-index="1"]').hidden,
    true,
  );
  page.click('.reset-button');
  page.click('#confirm-reset');
  assert.equal(page.document.getElementById('empty').hidden, false);
  page.click('#clear-filters');
  page.click('#next-entry');
  assert.equal(
    page.document.querySelector('.entry[data-index="1"] .reset-button')
      .disabled,
    true,
  );
  page.edit('#translation-1-zh_CN', '');
  page.click('#previous-entry');
  page.click('#generate');
  assert.equal(page.document.getElementById('prompt-dialog').open, false);
  assert.equal(
    page.document.querySelector('.entry[data-index="1"]').hidden,
    false,
  );
  assert.match(page.document.activeElement.textContent, /译文不能为空/);
  assert.match(
    page.document.getElementById('action-hint').textContent,
    /1 个词条需要调整/,
  );
});

function scrollFixture(page) {
  const { document } = page;
  const viewport = document.defaultView;
  const scroller = document.getElementById('editor-scroll');
  const offsets = [0, 600];
  const bounds = (top, height) => ({ top, bottom: top + height, height });
  Object.defineProperties(scroller, {
    clientHeight: { value: 500, configurable: true },
    scrollHeight: { value: 1200, configurable: true },
  });
  scroller.getBoundingClientRect = () => bounds(120, 500);
  document.querySelector('.editor-toolbar').getBoundingClientRect = () =>
    bounds(0, 57);
  [...document.querySelectorAll('.entry')].forEach((entry, index) => {
    entry.getBoundingClientRect = () => {
      const desktop = viewport.innerWidth > 640;
      return bounds(
        (desktop ? 120 : 57) +
          offsets[index] -
          (desktop ? scroller.scrollTop : viewport.scrollY),
        600,
      );
    };
  });
  return {
    offsets,
    scrollTo(top, mobile = false) {
      if (mobile) {
        viewport.innerWidth = 390;
        viewport.innerHeight = 500;
        Object.defineProperty(document.documentElement, 'scrollHeight', {
          value: 1257,
          configurable: true,
        });
        viewport.scrollY = top;
        viewport.dispatchEvent(new viewport.Event('scroll'));
      } else {
        scroller.scrollTop = top;
        scroller.dispatchEvent(new viewport.Event('scroll'));
      }
      page.flushAnimationFrame();
    },
    active() {
      return document.querySelector('.nav-entry[aria-current="true"]').dataset
        .index;
    },
  };
}

test('manual desktop scrolling follows section headings and the last section without scrolling the content again', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  const scroll = scrollFixture(page);
  scroll.scrollTo(200);
  assert.equal(scroll.active(), '0');
  scroll.scrollTo(550);
  assert.equal(scroll.active(), '1');
  assert.equal(page.document.getElementById('position').textContent, '2 / 2');
  assert.equal(page.document.getElementById('next-entry').disabled, true);
  assert.equal(
    page.scrollCalls.length,
    0,
    'Scroll tracking must not reposition the editor',
  );
  assert.equal(
    page.document.querySelectorAll('.entry:not([hidden])').length,
    2,
  );
  scroll.scrollTo(0);
  assert.equal(scroll.active(), '0');
  scroll.offsets[1] = 950;
  scroll.scrollTo(700);
  assert.equal(
    scroll.active(),
    '1',
    'A short last section must be selected at the bottom',
  );
});

test('page scrolling on narrow screens and layout changes update navigation without changing edits', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  const scroll = scrollFixture(page);
  page.edit('#translation-0-zh_CN', '保留此编辑');
  scroll.scrollTo(550, true);
  assert.equal(scroll.active(), '1');
  scroll.offsets[1] = 900;
  const group = page.document.querySelector('.other-locales');
  group.open = true;
  group.dispatchEvent(new page.document.defaultView.Event('toggle'));
  page.flushAnimationFrame();
  assert.equal(
    scroll.active(),
    '0',
    'Expanding a preceding section must update the current section',
  );
  assert.equal(
    page.document.getElementById('translation-0-zh_CN').value,
    '保留此编辑',
  );
  scroll.scrollTo(0, true);
  assert.equal(scroll.active(), '0');
});

test('navigation follows visible search results, skips filtered sections and keeps edits discoverable', async (t) => {
  const ctx = await prepared(t);
  addSecondEntry(ctx.plan);
  const page = browser(t, ctx.plan);
  const scroll = scrollFixture(page);
  page.edit('#search', 'privacy');
  assert.equal(page.document.getElementById('entry-0').hidden, true);
  assert.equal(scroll.active(), '1');
  scroll.scrollTo(0);
  assert.equal(scroll.active(), '1');
  page.edit('#search', '');
  assert.equal(
    page.document.querySelectorAll('.entry:not([hidden])').length,
    2,
  );
  page.edit('#translation-1-en_US', 'Keep your wallets private');
  assert.equal(
    page.document.getElementById('entry-title-1').textContent,
    'Keep your wallets private',
  );
  page.document.getElementById('translation-1-en_US').focus();
  assert.equal(scroll.active(), '1');
  assert.equal(
    page.document.querySelectorAll('.entry:not([hidden])').length,
    2,
  );
});

test('instructions live in the header and source locations use accessible floating help without changing translations', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  const view = document.defaultView;
  assert(
    document
      .querySelector('.masthead .header-guide')
      .textContent.includes('直接编辑文案'),
  );
  assert.equal(document.querySelector('#editor-scroll .header-guide'), null);
  for (const selector of ['#review-help', '.sources']) {
    const help = document.querySelector(selector);
    const trigger = help.querySelector('summary');
    const tooltip = help.querySelector('[role="tooltip"]');
    assert.equal(help.open, false);
    assert.equal(trigger.getAttribute('aria-describedby'), tooltip.id);
    assert.equal(view.getComputedStyle(tooltip).position, 'absolute');
    help.dispatchEvent(new view.MouseEvent('mouseenter'));
    assert.equal(help.open, true);
    help.dispatchEvent(new view.MouseEvent('mouseleave'));
    assert.equal(help.open, false);
    trigger.focus();
    assert.equal(help.open, true);
    trigger.click();
    assert.equal(
      help.open,
      true,
      'Click must not close a help popup just opened by focus',
    );
    trigger.dispatchEvent(
      new view.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    assert.equal(help.open, false);
    trigger.click();
    page.click('.key-input');
    assert.equal(help.open, false);
  }
  const sourceText = document.querySelector(
    '.sources [role="tooltip"]',
  ).textContent;
  assert(
    ctx.plan.entries[0].sources.every((source) =>
      sourceText.includes(`${source.file}:${source.line}`),
    ),
  );
  assert.equal(page.feedback().intent, 'approve');
});

test('editable fields start with one row and auto-fit measured content on load, input and viewport resize', async (t) => {
  const ctx = await prepared(t);
  let measuredHeight = 120;
  const page = browser(t, ctx.plan, {
    prepareWindow(window) {
      window.Element.prototype.getClientRects = function getClientRects() {
        return this.id === 'translation-0-en_US' ? [{ width: 200 }] : [];
      };
      Object.defineProperty(window.Element.prototype, 'scrollHeight', {
        configurable: true,
        get() {
          return this.id === 'translation-0-en_US' ? measuredHeight : 0;
        },
      });
    },
  });
  assert(
    [...page.document.querySelectorAll('.entry textarea')].every(
      (input) => input.rows === 1,
    ),
  );
  const input = page.document.getElementById('translation-0-en_US');
  assert.equal(
    input.style.height,
    '122px',
    'Existing long copy must fit before any interaction',
  );
  measuredHeight = 32;
  page.edit('#translation-0-en_US', 'Short');
  assert.equal(
    input.style.height,
    '34px',
    'Shortening text must remove leftover height',
  );
  measuredHeight = 180;
  page.document.defaultView.dispatchEvent(
    new page.document.defaultView.Event('resize'),
  );
  page.flushAnimationFrame();
  assert.equal(
    input.style.height,
    '182px',
    'Reflow at a new width must fit the entire translation',
  );
});

test('language and key labels share their header with compact comment controls', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  assert.equal(
    document.querySelectorAll('.translation-header .comment-toggle').length,
    19,
  );
  for (const header of document.querySelectorAll(
    '.translation-header, .key-header',
  )) {
    const button = header.querySelector('.comment-toggle');
    assert.equal(button.textContent, '评论');
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    assert.equal(panel.hidden, true);
    assert.equal(
      header.contains(panel),
      false,
      'The open editor must use the full field width',
    );
    assert.match(button.getAttribute('aria-label'), /的.*评论/);
  }
  assert.equal(document.querySelector('.reset-button').hidden, true);
  assert.equal(document.querySelector('.key-meta'), null);
});

test('empty or whitespace-only comments collapse on blur while written comments remain open and preserved', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  for (const id of ['comment-key-0', 'comment-0-en_US', 'comment-0-de']) {
    if (id.endsWith('-de')) page.click('#toggle-all');
    const button = document.querySelector(`[aria-controls="${id}"]`);
    const panel = document.getElementById(id);
    button.click();
    assert.equal(document.activeElement, panel.querySelector('textarea'));
    document.querySelector('.key-input').focus();
    assert.equal(panel.hidden, true);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    button.click();
    page.edit(`#${id} textarea`, '  \n ');
    document.querySelector('.key-input').focus();
    assert.equal(panel.hidden, true);
    assert.equal(button.classList.contains('has-comment'), false);
    button.click();
    page.edit(`#${id} textarea`, '请保留我的意见');
    document.querySelector('.key-input').focus();
    assert.equal(panel.hidden, false);
    assert.equal(panel.querySelector('textarea').value, '请保留我的意见');
    assert.equal(button.textContent, '评论');
    assert(button.classList.contains('has-comment'));
  }
  const feedback = page.feedback();
  assert.equal(feedback.changes[0].note, '请保留我的意见');
  assert.equal(feedback.changes[0].translationNotes.de, '请保留我的意见');
  assert(
    !document.getElementById('change-count').textContent.includes('0 处修改'),
  );
});

test('a focused empty comment closes with one click and Escape preserves written feedback', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  const button = document.querySelector('[aria-controls="comment-0-en_US"]');
  const panel = document.getElementById('comment-0-en_US');
  const input = panel.querySelector('textarea');
  button.click();
  const pointer = new document.defaultView.MouseEvent('pointerdown', {
    cancelable: true,
    bubbles: true,
  });
  button.dispatchEvent(pointer);
  assert.equal(pointer.defaultPrevented, true);
  button.click();
  assert.equal(panel.hidden, true);
  assert.equal(document.activeElement, button);
  button.click();
  page.edit('#comment-0-en_US textarea', 'Keep this feedback');
  input.dispatchEvent(
    new document.defaultView.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    }),
  );
  assert.equal(panel.hidden, true);
  assert.equal(document.activeElement, button);
  button.click();
  assert.equal(input.value, 'Keep this feedback');
  assert.equal(document.activeElement, input);
  page.edit('#comment-0-en_US textarea', '');
  document.querySelector('[aria-controls="comment-0-zh_CN"]').click();
  assert.equal(panel.hidden, true);
  assert.equal(
    document.activeElement,
    document.querySelector('#comment-0-zh_CN textarea'),
  );
});

test('original-copy comparisons are inline popovers and disappear when a translation is restored', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  const input = document.getElementById('translation-0-en_US');
  const header = input
    .closest('.translation')
    .querySelector('.translation-header');
  const original = header.querySelector('.before');
  assert.equal(original.hidden, true);
  page.edit('#translation-0-en_US', 'Edited English');
  assert.equal(original.hidden, false);
  assert.equal(document.querySelector('.reset-button').hidden, false);
  original.querySelector('summary').click();
  assert.equal(original.open, true);
  const tooltip = original.querySelector('[role="tooltip"]');
  assert.equal(
    document.defaultView.getComputedStyle(tooltip).position,
    'absolute',
  );
  assert.equal(tooltip.textContent, 'Travel Mode');
  page.edit('#translation-0-en_US', 'Travel Mode');
  assert.equal(original.open, false);
  assert.equal(original.hidden, true);
  assert.equal(document.querySelector('.reset-button').hidden, true);
  assert.equal(page.feedback().intent, 'approve');
});

test('left-column comparison popovers stay within the editor and open upward near its bottom', async (t) => {
  const ctx = await prepared(t);
  const page = browser(t, ctx.plan);
  const { document } = page;
  page.edit('#translation-0-en_US', 'Edited');
  const help = document.querySelector('.bilingual .before');
  const content = help.querySelector('.tooltip-content');
  document.getElementById('editor-scroll').getBoundingClientRect = () => ({
    left: 300,
    right: 1000,
    top: 120,
    bottom: 600,
  });
  document.querySelector('.editor-toolbar').getBoundingClientRect = () => ({
    bottom: 120,
  });
  help.getBoundingClientRect = () => ({
    left: 400,
    right: 450,
    top: 540,
    bottom: 560,
  });
  content.getBoundingClientRect = () => ({ left: 70, width: 380, height: 180 });
  help.querySelector('summary').click();
  assert.equal(
    content.style.left,
    '-92px',
    'The panel starts at editor left + 8px, not inside the sidebar',
  );
  // JSDOM ignores 'auto' offsets, so verify the flipped edge and available space.
  assert.equal(content.style.bottom, '100%');
  assert.equal(content.style.maxHeight, '412px');
  assert.equal(document.defaultView.getComputedStyle(content).overflow, 'auto');
});
