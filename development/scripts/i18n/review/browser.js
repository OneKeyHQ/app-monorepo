/* global document, localStorage, navigator, reviewUi */
(() => {
  const model = JSON.parse(document.getElementById('review-data').textContent);
  const byId = (id) => document.getElementById(id);
  const { node } = reviewUi;
  const storageKey = `onekey-i18n-review:${model.approval}${model.revisionId ? `:${model.revisionId}` : ''}`;
  const state = model.initialState || {
    mode: model.mode,
    entries: model.entries.map((entry) => ({
      key: entry.key,
      translations: { ...entry.translations },
      note: '',
      translationNotes: {},
    })),
  };
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (
      saved?.approval === model.approval &&
      saved.entries?.length === state.entries.length &&
      ['complete', 'update'].includes(saved.mode)
    ) {
      saved.entries.forEach((entry, index) => {
        if (
          typeof entry.key === 'string' &&
          typeof entry.note === 'string' &&
          model.locales.every(
            (locale) => typeof entry.translations?.[locale] === 'string',
          ) &&
          entry.translationNotes &&
          Object.entries(entry.translationNotes).every(
            ([locale, note]) =>
              model.locales.includes(locale) && typeof note === 'string',
          )
        )
          state.entries[index] = entry;
      });
      state.mode = saved.mode;
      restored = true;
    }
  } catch {
    /* Browser storage is optional for standalone files. */
  }
  const statistics = (index) => {
    const entry = state.entries[index];
    const original = model.entries[index];
    return {
      edits:
        Number(entry.key !== original.key) +
        model.locales.filter(
          (locale) =>
            entry.translations[locale] !== original.translations[locale],
        ).length,
      notes:
        Number(Boolean(entry.note.trim())) +
        Object.values(entry.translationNotes).filter((note) => note.trim())
          .length,
    };
  };
  const changed = (index) => {
    const stats = statistics(index);
    return Boolean(stats.edits || stats.notes);
  };
  const cards = [];
  const navigation = [];
  let activeIndex = 0;
  let visibleIndices = [];
  let pendingReset = null;
  let lastSearch = '';
  let preSearchOpen = null;
  let scrollSyncQueued = false;
  let editorResizeQueued = false;
  let lastGeneratedPrompt = '';
  function scheduleEditorResize() {
    if (editorResizeQueued) return;
    editorResizeQueued = true;
    globalThis.requestAnimationFrame(() => {
      editorResizeQueued = false;
      reviewUi.resizeVisible(byId('entries'));
      scheduleScrollSync();
    });
  }
  function selectEntry(index, followNavigation = false) {
    activeIndex = index;
    cards.forEach(({ card }, itemIndex) => {
      card.classList.toggle('is-current', itemIndex === index);
      navigation[itemIndex].button.setAttribute(
        'aria-current',
        String(itemIndex === index),
      );
    });
    const position = visibleIndices.indexOf(index);
    byId('position').textContent = `${position + 1} / ${visibleIndices.length}`;
    byId('previous-entry').disabled = position <= 0;
    byId('next-entry').disabled =
      position < 0 || position >= visibleIndices.length - 1;
    if (followNavigation && navigation[index]) {
      const nav = byId('entry-nav');
      const bounds = nav.getBoundingClientRect();
      const item = navigation[index].button.getBoundingClientRect();
      if (item.top < bounds.top) nav.scrollTop += item.top - bounds.top;
      else if (item.bottom > bounds.bottom)
        nav.scrollTop += item.bottom - bounds.bottom;
    }
  }
  function syncScrollPosition() {
    if (!visibleIndices.length || document.querySelector('dialog[open]'))
      return;
    const pageScroll = globalThis.matchMedia('(max-width: 640px)').matches;
    const scroller = byId('editor-scroll');
    const top = pageScroll
      ? Math.max(
          0,
          document.querySelector('.editor-toolbar').getBoundingClientRect()
            .bottom,
        )
      : scroller.getBoundingClientRect().top;
    const height = pageScroll ? globalThis.innerHeight : scroller.clientHeight;
    const contentHeight = pageScroll
      ? document.documentElement.scrollHeight
      : scroller.scrollHeight;
    const scrollTop = pageScroll ? globalThis.scrollY : scroller.scrollTop;
    const atBottom =
      contentHeight > height && scrollTop + height >= contentHeight - 2;
    let index = visibleIndices[0];
    for (const candidate of visibleIndices) {
      if (cards[candidate].card.getBoundingClientRect().top <= top + 80)
        index = candidate;
      else break;
    }
    if (atBottom) index = visibleIndices.at(-1);
    if (index !== activeIndex) selectEntry(index, true);
  }
  function scheduleScrollSync() {
    if (scrollSyncQueued) return;
    scrollSyncQueued = true;
    globalThis.requestAnimationFrame(() => {
      scrollSyncQueued = false;
      syncScrollPosition();
    });
  }
  function save() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...state, approval: model.approval }),
      );
      byId('save-state').textContent = '修改已保存在此浏览器';
    } catch {
      byId('save-state').textContent = '无法保存，关闭前请复制提示词';
    }
  }
  function errors(index) {
    const entry = state.entries[index];
    const original = model.entries[index];
    if (!/^[a-zA-Z0-9_.$:]+$/.test(entry.key))
      return 'Key 不能为空，且只能包含字母、数字、下划线、点、冒号或 $。';
    const normalized = (key) =>
      key.replaceAll('::', '.').replace(/[^A-Za-z0-9_$]/g, '_');
    if (
      state.entries.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          normalized(other.key) === normalized(entry.key),
      )
    )
      return '这个 key 与另一个词条重复或产生枚举冲突。';
    if (model.locales.some((locale) => !entry.translations[locale].trim()))
      return '译文不能为空；不确定怎么修改时，可以保留原文并评论。';
    if (
      state.mode === 'complete' &&
      original.existing &&
      entry.key.replaceAll('::', '.') === original.key.replaceAll('::', '.') &&
      model.locales.some(
        (locale) =>
          original.before[locale]?.trim() &&
          original.before[locale] !== entry.translations[locale],
      )
    )
      return '修改已有非空译文需要选择「更新」模式。也可以只留评论。';
    return '';
  }
  function updateToggle() {
    const allOpen = cards.length > 0 && cards.every(({ group }) => group.open);
    byId('toggle-all').textContent = allOpen ? '折叠其他语言' : '展开全部语言';
    byId('toggle-all').setAttribute('aria-pressed', String(allOpen));
    byId('toggle-all').disabled = cards.length === 0;
  }
  function onLanguageToggle(event) {
    updateToggle();
    if (
      event.currentTarget.open &&
      !event.currentTarget.closest('.entry').hidden
    )
      reviewUi.resizeVisible(event.currentTarget);
    scheduleScrollSync();
  }
  function update() {
    const query = byId('search').value.trim().toLowerCase();
    const searchChanged = query !== lastSearch;
    if (searchChanged && query && !lastSearch)
      preSearchOpen = cards.map(({ group }) => group.open);
    visibleIndices = [];
    let count = 0;
    let edits = 0;
    let notes = 0;
    let invalidCount = 0;
    cards.forEach((view, index) => {
      const {
        card,
        badge,
        error,
        fields,
        keyInput,
        renameHint,
        reset,
        group,
        groupStatus,
      } = view;
      const original = model.entries[index];
      const entry = state.entries[index];
      view.title.textContent =
        entry.translations.en_US.trim() || entry.key || original.key;
      view.title.title = view.title.textContent;
      const stats = statistics(index);
      const dirty = Boolean(stats.edits || stats.notes);
      if (dirty) count += 1;
      edits += stats.edits;
      notes += stats.notes;
      const entryError = errors(index);
      if (entryError) invalidCount += 1;
      card.classList.toggle('changed', dirty);
      badge.textContent = original.existing ? '已有' : '新增';
      if (dirty)
        badge.textContent = [
          stats.edits ? `${stats.edits} 处修改` : '',
          stats.notes ? `${stats.notes} 条评论` : '',
        ]
          .filter(Boolean)
          .join(' · ');
      badge.classList.toggle('dirty', dirty);
      reset.disabled = !dirty;
      reset.hidden = !dirty;
      keyInput.classList.toggle('modified', entry.key !== original.key);
      renameHint.hidden = entry.key === original.key;
      renameHint.textContent = `原 key：${original.key} → 新 key：${entry.key}`;
      const haystack = [
        entry.key,
        original.key,
        ...Object.values(entry.translations),
        entry.note,
        ...Object.values(entry.translationNotes),
      ]
        .join('\n')
        .toLowerCase();
      const matches =
        haystack.includes(query) && (!byId('only-changed').checked || dirty);
      card.hidden = !matches;
      if (matches) visibleIndices.push(index);
      const nav = navigation[index];
      nav.button.hidden = !matches;
      nav.key.classList.toggle('modified', stats.edits > 0);
      nav.key.textContent = entry.key || '未填写 key';
      nav.english.textContent = entry.translations.en_US;
      nav.chinese.textContent = entry.translations.zh_CN;
      nav.status.textContent = dirty ? badge.textContent : '';
      if (entryError) nav.status.textContent = '需要调整';
      nav.status.hidden = !nav.status.textContent;
      nav.status.classList.toggle('has-error', Boolean(entryError));
      error.textContent = entryError;
      error.hidden = !entryError;
      let otherCount = 0;
      let foreignMatch = false;
      fields.forEach(({ row, input, locale, baseline, fieldStatus, note }) => {
        const modified =
          entry.translations[locale] !== original.translations[locale];
        const commented = Boolean(entry.translationNotes[locale]?.trim());
        input.classList.toggle('modified', modified);
        baseline.hidden = !modified;
        if (!modified) baseline.open = false;
        fieldStatus.textContent = modified ? '已修改' : '';
        fieldStatus.hidden = !modified;
        const isOther = !['en_US', 'zh_CN'].includes(locale);
        if (isOther && (modified || commented)) otherCount += 1;
        const commentMatch = Boolean(
          query &&
          entry.translationNotes[locale]?.toLowerCase().includes(query),
        );
        const fieldMatch = Boolean(
          query &&
          (entry.translations[locale].toLowerCase().includes(query) ||
            commentMatch),
        );
        row.classList.toggle('search-match', fieldMatch);
        if (fieldMatch && isOther) foreignMatch = true;
        if (searchChanged && commentMatch) note.open = true;
      });
      groupStatus.textContent = otherCount
        ? `${otherCount} 种有修改 / 评论`
        : '';
      if (searchChanged) {
        group.open = query
          ? Boolean(preSearchOpen?.[index] || foreignMatch)
          : Boolean(preSearchOpen?.[index]);
        if (query && entry.note.toLowerCase().includes(query))
          view.keyComment.open = true;
      }
    });
    if (!visibleIndices.includes(activeIndex))
      activeIndex = visibleIndices[0] ?? -1;
    selectEntry(activeIndex);
    byId('visible-count').textContent =
      `${visibleIndices.length} / ${cards.length} 个词条`;
    byId('empty').hidden = visibleIndices.length !== 0;
    byId('change-count').textContent =
      state.mode !== model.mode ? '已调整操作模式' : '尚未修改';
    if (count)
      byId('change-count').textContent = [
        `${count} 个词条`,
        edits ? `${edits} 处修改` : '',
        notes ? `${notes} 条评论` : '',
      ]
        .filter(Boolean)
        .join(' · ');
    byId('action-hint').textContent = invalidCount
      ? `${invalidCount} 个词条需要调整，点击确认可定位`
      : '复制提示词回对话后继续处理';
    byId('action-hint').classList.toggle('has-error', invalidCount > 0);
    byId('mode-description').textContent =
      state.mode === 'complete'
        ? '仅新增词条、填补空译文；保留已有文案。'
        : '允许新增词条，以及修改已有译文。';
    lastSearch = query;
    if (!query) preSearchOpen = null;
    if (searchChanged) scheduleEditorResize();
    updateToggle();
  }
  function reveal(index, { focus = false, searchMatch = false } = {}) {
    activeIndex = index;
    update();
    const view = cards[activeIndex];
    if (!view) return;
    reviewUi.resize(view.keyInput);
    view.fields.forEach(({ input, note }) => {
      reviewUi.resize(input);
      if (note.open) reviewUi.resize(note.input);
    });
    const target = searchMatch
      ? view.card.querySelector('.search-match') || view.card
      : view.card;
    target.scrollIntoView({ block: 'start' });
    if (focus) view.keyInput.focus();
  }
  function onEdit() {
    save();
    update();
    scheduleScrollSync();
  }
  function requestReset(index) {
    if (!changed(index)) return;
    pendingReset = index;
    byId('reset-key').textContent =
      state.entries[index].key || model.entries[index].key;
    byId('reset-dialog').showModal();
    byId('cancel-reset').focus();
  }
  model.entries.forEach((entry, index) => {
    const button = node('button', 'nav-entry');
    button.type = 'button';
    button.dataset.index = String(index);
    button.setAttribute('aria-controls', `entry-${index}`);
    const content = node('span', 'nav-content');
    const key = node('span', 'nav-key');
    const english = node('span', 'nav-en');
    const chinese = node('span', 'nav-zh');
    const status = node('span', 'nav-status');
    content.append(key, english, chinese, status);
    button.append(
      node('span', 'nav-number', String(index + 1).padStart(2, '0')),
      content,
    );
    button.addEventListener('click', () =>
      reveal(index, { searchMatch: Boolean(lastSearch) }),
    );
    button.addEventListener('keydown', (event) => {
      const offset = visibleIndices.indexOf(index);
      const targets = {
        ArrowDown: visibleIndices[offset + 1],
        ArrowUp: visibleIndices[offset - 1],
        Home: visibleIndices[0],
        End: visibleIndices.at(-1),
      };
      if (targets[event.key] !== undefined) {
        event.preventDefault();
        reveal(targets[event.key], { searchMatch: Boolean(lastSearch) });
        navigation[activeIndex].button.focus();
      }
    });
    navigation.push({ button, key, english, chinese, status });
    byId('entry-nav').append(button);
    const view = reviewUi.buildCard(
      model,
      state,
      index,
      onEdit,
      requestReset,
      onLanguageToggle,
    );
    cards.push(view);
    byId('entries').append(view.card);
  });
  byId('project').textContent = model.project.name;
  byId('totals').textContent =
    `${model.entries.length} 个 · ${model.locales.length} 种语言`;
  let planState = '待确认';
  if (model.applied) planState = '已上传 · 可继续修改';
  if (model.initialState) planState = '待确认修订';
  byId('plan-state').textContent = planState;
  byId('mode').value = state.mode;
  if (restored) byId('save-state').textContent = '已恢复此方案的本地修改';
  byId('cancel-reset').addEventListener('click', () => {
    pendingReset = null;
    byId('reset-dialog').close();
  });
  const clearPendingReset = () => {
    pendingReset = null;
  };
  byId('reset-dialog').addEventListener('cancel', clearPendingReset);
  byId('reset-dialog').addEventListener('close', clearPendingReset);
  byId('confirm-reset').addEventListener('click', () => {
    if (pendingReset === null) return;
    const index = pendingReset;
    const original = model.entries[index];
    state.entries[index] = {
      key: original.key,
      translations: { ...original.translations },
      note: '',
      translationNotes: {},
    };
    const previous = cards[index];
    const view = reviewUi.buildCard(
      model,
      state,
      index,
      onEdit,
      requestReset,
      onLanguageToggle,
    );
    view.group.open = previous.group.open;
    cards[index] = view;
    previous.card.replaceWith(view.card);
    pendingReset = null;
    byId('reset-dialog').close();
    save();
    reveal(index);
    if (activeIndex >= 0) cards[activeIndex].keyInput.focus();
  });
  byId('mode').addEventListener('change', () => {
    state.mode = byId('mode').value;
    onEdit();
  });
  byId('search').addEventListener('input', () =>
    reveal(activeIndex, { searchMatch: true }),
  );
  byId('only-changed').addEventListener('change', () => {
    reveal(activeIndex);
    scheduleEditorResize();
  });
  byId('clear-filters').addEventListener('click', () => {
    byId('search').value = '';
    byId('only-changed').checked = false;
    reveal(visibleIndices[0] ?? 0);
    scheduleEditorResize();
    byId('search').focus();
  });
  byId('previous-entry').addEventListener('click', () =>
    reveal(visibleIndices[visibleIndices.indexOf(activeIndex) - 1]),
  );
  byId('next-entry').addEventListener('click', () =>
    reveal(visibleIndices[visibleIndices.indexOf(activeIndex) + 1]),
  );
  byId('toggle-all').addEventListener('click', () => {
    const open = !cards.every(({ group }) => group.open);
    cards.forEach(({ group }) => {
      group.open = open;
    });
    if (lastSearch) preSearchOpen = cards.map(() => open);
    updateToggle();
  });
  byId('generate').addEventListener('click', () => {
    const invalid = state.entries.findIndex((entry, index) =>
      Boolean(errors(index)),
    );
    if (invalid !== -1) {
      byId('only-changed').checked = false;
      byId('search').value = '';
      reveal(invalid);
      cards[invalid].error.scrollIntoView({ block: 'center' });
      cards[invalid].error.tabIndex = -1;
      cards[invalid].error.focus();
      return;
    }
    const changes = [];
    state.entries.forEach((entry, index) => {
      if (!changed(index)) return;
      const original = model.entries[index];
      const translations = Object.fromEntries(
        model.locales
          .filter(
            (locale) =>
              entry.translations[locale] !== original.translations[locale],
          )
          .map((locale) => [locale, entry.translations[locale]]),
      );
      const translationNotes = Object.fromEntries(
        Object.entries(entry.translationNotes).filter(([, value]) =>
          value.trim(),
        ),
      );
      changes.push({
        key: original.key,
        ...(entry.key !== original.key ? { newKey: entry.key } : {}),
        ...(Object.keys(translations).length ? { translations } : {}),
        ...(entry.note.trim() ? { note: entry.note.trim() } : {}),
        ...(Object.keys(translationNotes).length ? { translationNotes } : {}),
      });
    });
    const intent =
      changes.length || state.mode !== model.mode ? 'revise' : 'approve';
    const payload = {
      schemaVersion: 1,
      kind: 'i18n-review',
      baseApproval: model.approval,
      planFile: model.planFile,
      mode: state.mode,
      intent,
      changes,
    };
    let lead = model.applied
      ? '这个 i18n 方案已经执行，无需重复上传。'
      : '我确认这份 i18n 预览。请校验原方案标识后，按既定流程上传、拉取并核验。';
    if (intent === 'revise')
      lead =
        '请根据以下 i18n 审阅结果修改词条与译文。直接编辑的内容是我的建议；词条评论和各语言评论需要你结合上下文思考并修改。请用 i18n:workflow review-import 导入这段反馈，补齐受影响语言，说明如何处理评论，再生成新版 Markdown 和可交互 HTML 供我二次确认。这次是修改请求，请不要沿用旧方案确认或直接上传。';
    const renames = changes
      .filter((change) => change.newKey)
      .map((change) => `原 key：${change.key}\n新 key：${change.newKey}`)
      .join('\n\n');
    const generatedPrompt = `${lead}\n\n原方案：${model.planFile}${renames ? `\n\nKey 修改对应关系：\n${renames}` : ''}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
    // Preserve manual edits when reopening an unchanged review.
    if (generatedPrompt !== lastGeneratedPrompt) {
      byId('prompt').value = generatedPrompt;
      byId('prompt').classList.remove('modified');
      lastGeneratedPrompt = generatedPrompt;
    }
    byId('prompt-title').textContent =
      intent === 'revise' ? '确认本轮修改' : '确认当前方案';
    byId('prompt-description').textContent = model.applied
      ? '此方案已经上传，没有新增修改。'
      : '复制提示词回对话后，模型会按当前方案上传、拉取并核验。';
    if (intent === 'revise')
      byId('prompt-description').textContent =
        '核对下方修改与评论，再复制提示词回对话。模型会处理后生成新版预览，等待你二次确认。';
    reviewUi.renderSummary(byId('change-summary'), model, state, changes);
    byId('prompt-details').open = byId('prompt').value !== lastGeneratedPrompt;
    byId('copy-state').textContent = '可修改或追加提示词，再复制回对话。';
    byId('prompt-dialog').showModal();
  });
  const closePrompt = () => byId('prompt-dialog').close();
  byId('close-dialog').addEventListener('click', closePrompt);
  byId('back-to-edit').addEventListener('click', closePrompt);
  byId('prompt').addEventListener('input', () => {
    byId('prompt').classList.toggle(
      'modified',
      byId('prompt').value !== lastGeneratedPrompt,
    );
    byId('copy-state').textContent = '提示词已修改，请复制最新内容。';
  });
  byId('copy').addEventListener('click', async () => {
    const text = byId('prompt').value;
    try {
      await navigator.clipboard.writeText(text);
      byId('copy-state').textContent =
        text === byId('prompt').value
          ? '已复制，回到对话粘贴即可。'
          : '提示词已修改，请复制最新内容。';
    } catch {
      byId('prompt-details').open = true;
      byId('prompt').focus();
      byId('prompt').select();
      byId('copy-state').textContent = '已选中提示词，请按 ⌘C 或 Ctrl+C 复制。';
    }
  });
  byId('editor-scroll').addEventListener('scroll', scheduleScrollSync, {
    passive: true,
  });
  globalThis.addEventListener('scroll', scheduleScrollSync, { passive: true });
  globalThis.addEventListener('resize', scheduleEditorResize);
  byId('entries').addEventListener('toggle', scheduleScrollSync, true);
  byId('entries').addEventListener('focusout', scheduleScrollSync);
  byId('entries').addEventListener('focusin', (event) => {
    const card = event.target.closest('.entry');
    if (card) selectEntry(Number(card.dataset.index), true);
  });
  reviewUi.activateHelp(byId('review-help'));
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.help[open]').forEach((details) => {
      if (!details.contains(event.target)) details.open = false;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      document.querySelectorAll('.help[open]').forEach((details) => {
        details.open = false;
      });
  });
  update();
  reviewUi.resizeVisible(byId('entries'));
})();
