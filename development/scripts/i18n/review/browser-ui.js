/* global document */
function createReviewUi() {
  const languageNames = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
  const label = (locale) =>
    ({ en_US: 'English', zh_CN: '简体中文' })[locale] ||
    languageNames.of(locale.replaceAll('_', '-')) ||
    locale;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const resize = (input) => {
    input.style.height = 'auto';
    if (input.scrollHeight) input.style.height = `${input.scrollHeight + 2}px`;
  };
  const resizeVisible = (container) => {
    container.querySelectorAll('textarea').forEach((input) => {
      if (input.getClientRects().length) resize(input);
    });
  };
  function activateHelp(details) {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.tooltip-content');
    let hovered = false;
    const open = () => {
      details.open = true;
      const area = details.closest('.editor-scroll')?.getBoundingClientRect();
      const toolbar = details
        .closest('.editor')
        ?.querySelector('.editor-toolbar')
        .getBoundingClientRect();
      const left = Math.max(0, area?.left ?? 0) + 8;
      const right =
        Math.min(globalThis.innerWidth, area?.right ?? globalThis.innerWidth) -
        8;
      const top = Math.max(0, area?.top ?? 0, toolbar?.bottom ?? 0) + 8;
      const bottom =
        Math.min(
          globalThis.innerHeight,
          area?.bottom ?? globalThis.innerHeight,
        ) - 8;
      Object.assign(content.style, {
        left: 'auto',
        right: '0',
        top: '100%',
        bottom: 'auto',
        maxWidth: `${Math.max(0, right - left)}px`,
        maxHeight: 'none',
      });
      const anchor = details.getBoundingClientRect();
      const bounds = content.getBoundingClientRect();
      if (!bounds.width) return;
      content.style.left = `${Math.max(left, Math.min(bounds.left, right - bounds.width)) - anchor.left}px`;
      content.style.right = 'auto';
      const above = anchor.top - top;
      const below = bottom - anchor.bottom;
      const flip = bounds.height > below && above > below;
      content.style.top = flip ? 'auto' : '100%';
      content.style.bottom = flip ? '100%' : 'auto';
      content.style.maxHeight = `${Math.max(0, flip ? above : below)}px`;
    };
    details.addEventListener('mouseenter', () => {
      hovered = true;
      open();
    });
    details.addEventListener('mouseleave', () => {
      hovered = false;
      if (!details.contains(document.activeElement)) details.open = false;
    });
    summary.addEventListener('focus', open);
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      open();
    });
    details.addEventListener('focusout', (event) => {
      if (!hovered && !details.contains(event.relatedTarget))
        details.open = false;
    });
    details.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        details.open = false;
        event.stopPropagation();
      }
    });
  }
  function comment(value, onInput, inputLabel, id) {
    const panel = node('div', 'note');
    panel.id = id;
    const trigger = node('button', 'comment-toggle', '评论');
    trigger.type = 'button';
    trigger.setAttribute('aria-controls', id);
    const input = node('textarea');
    input.rows = 1;
    input.maxLength = 4000;
    input.value = value;
    input.placeholder = '描述你的想法，让模型调整。';
    input.setAttribute('aria-label', inputLabel);
    const refresh = () => {
      const hasComment = Boolean(input.value.trim());
      trigger.classList.toggle('has-comment', hasComment);
      trigger.setAttribute(
        'aria-label',
        `展开或收起${inputLabel}${hasComment ? '（已填写）' : ''}`,
      );
    };
    const setOpen = (open) => {
      if (!open && document.activeElement === input)
        trigger.focus({ preventScroll: true });
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    };
    trigger.addEventListener('pointerdown', (event) => {
      // Preserve input focus until click toggles the panel, avoiding a blur/reopen race.
      if (document.activeElement === input) event.preventDefault();
    });
    trigger.addEventListener('click', () => {
      setOpen(panel.hidden);
      if (!panel.hidden) {
        input.focus();
        resize(input);
      }
    });
    input.addEventListener('input', () => {
      onInput(input.value);
      refresh();
      resize(input);
    });
    input.addEventListener('blur', () => {
      if (!input.value.trim()) setOpen(false);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        event.stopPropagation();
      }
    });
    panel.append(input);
    setOpen(Boolean(value.trim()));
    refresh();
    return {
      panel,
      trigger,
      input,
      get open() {
        return !panel.hidden;
      },
      set open(isOpen) {
        setOpen(isOpen);
      },
    };
  }
  function beforeText(title, value, id) {
    const details = node('details', 'help before');
    const summary = node('summary', '', title);
    summary.setAttribute('aria-describedby', id);
    const content = node('div', 'tooltip-content');
    content.id = id;
    content.setAttribute('role', 'tooltip');
    content.append(node('p', '', value));
    details.append(summary, content);
    activateHelp(details);
    return details;
  }
  function buildCard(model, state, index, onEdit, onReset, onToggle) {
    const original = model.entries[index];
    const current = state.entries[index];
    const card = node('article', 'entry');
    card.dataset.index = String(index);
    card.id = `entry-${index}`;
    card.setAttribute('aria-labelledby', `entry-title-${index}`);
    const side = node('div', 'key-side');
    const head = node('header', 'entry-head');
    const heading = node('div', 'entry-heading');
    const title = node('h2', 'entry-title');
    title.id = `entry-title-${index}`;
    heading.append(title);
    const badge = node('span', 'badge');
    const reset = node('button', 'text-button reset-button', '恢复此词条');
    reset.type = 'button';
    reset.addEventListener('click', () => onReset(index));
    const actions = node('div', 'entry-actions');
    actions.append(badge, reset);
    head.append(
      node('span', 'number', String(index + 1).padStart(2, '0')),
      heading,
      actions,
    );
    const keyInput = node('textarea', 'key-input');
    keyInput.value = current.key;
    keyInput.rows = 1;
    keyInput.maxLength = 300;
    keyInput.spellcheck = false;
    keyInput.setAttribute('aria-label', `${original.key} 的 key`);
    keyInput.addEventListener('input', () => {
      current.key = keyInput.value;
      onEdit();
      resize(keyInput);
    });
    const renameHint = node('p', 'rename-hint');
    const keyComment = comment(
      current.note,
      (value) => {
        current.note = value;
        onEdit();
      },
      `${original.key} 的词条评论`,
      `comment-key-${index}`,
    );
    const sources = node('details', 'help sources');
    const sourceSummary = node('summary', '', '代码位置');
    sourceSummary.setAttribute('aria-describedby', `source-tooltip-${index}`);
    const sourceTooltip = node('div', 'tooltip-content');
    sourceTooltip.id = `source-tooltip-${index}`;
    sourceTooltip.setAttribute('role', 'tooltip');
    sources.append(sourceSummary);
    const sourceList = node('ul');
    for (const source of original.sources)
      sourceList.append(node('li', '', `${source.file}:${source.line}`));
    if (!original.sources.length)
      sourceList.append(node('li', '', '命令行输入'));
    sourceTooltip.append(sourceList);
    sources.append(sourceTooltip);
    activateHelp(sources);
    actions.insertBefore(sources, reset);
    const keyHeader = node('div', 'key-header');
    const keyTools = node('div', 'field-tools');
    keyTools.append(keyComment.trigger);
    keyHeader.append(node('span', 'key-label', 'KEY'), keyTools);
    side.append(head, keyHeader, keyInput, keyComment.panel, renameHint);
    if (original.reviewResponse)
      side.append(
        node('p', 'response-note', `本轮处理说明：${original.reviewResponse}`),
      );
    const copy = node('div', 'copy-side');
    const bilingual = node('div', 'bilingual');
    const group = node('details', 'other-locales');
    const groupSummary = node(
      'summary',
      '',
      `其他 ${model.locales.length - 2} 种语言`,
    );
    const groupStatus = node('span', 'other-status');
    groupSummary.append(groupStatus);
    const localeGrid = node('div', 'locale-grid');
    group.append(groupSummary, localeGrid);
    group.addEventListener('toggle', onToggle);
    const fields = [];
    for (const locale of [
      'en_US',
      'zh_CN',
      ...model.locales.filter((item) => !['en_US', 'zh_CN'].includes(item)),
    ]) {
      const row = node('div', 'translation');
      const header = node('div', 'translation-header');
      const caption = node('label', 'locale-name', label(locale));
      const input = node('textarea');
      input.id = `translation-${index}-${locale}`;
      input.lang = locale.replaceAll('_', '-');
      input.dir = 'auto';
      caption.htmlFor = input.id;
      caption.append(node('small', '', locale));
      const fieldStatus = node('span', 'field-status');
      input.value = current.translations[locale];
      input.rows = 1;
      input.maxLength = 20_000;
      input.setAttribute('aria-label', `${original.key} ${locale}`);
      input.addEventListener('input', () => {
        current.translations[locale] = input.value;
        onEdit();
        resize(input);
      });
      const baseline = beforeText(
        '预览原文',
        original.translations[locale],
        `baseline-${index}-${locale}`,
      );
      const note = comment(
        current.translationNotes[locale] || '',
        (value) => {
          current.translationNotes[locale] = value;
          onEdit();
        },
        `${original.key} ${locale} 的译文评论`,
        `comment-${index}-${locale}`,
      );
      const tools = node('div', 'field-tools');
      tools.append(fieldStatus, baseline);
      if (
        original.before[locale] &&
        original.before[locale] !== original.translations[locale]
      )
        tools.append(
          beforeText(
            '远端原文',
            original.before[locale],
            `remote-${index}-${locale}`,
          ),
        );
      tools.append(note.trigger);
      header.append(caption, tools);
      row.append(header, input, note.panel);
      fields.push({ row, input, locale, baseline, fieldStatus, note });
      if (['en_US', 'zh_CN'].includes(locale)) bilingual.append(row);
      else localeGrid.append(row);
    }
    const error = node('p', 'entry-error');
    error.setAttribute('role', 'alert');
    copy.append(bilingual, group, error);
    card.append(side, copy);
    return {
      card,
      title,
      badge,
      error,
      fields,
      keyInput,
      keyComment,
      renameHint,
      reset,
      group,
      groupStatus,
    };
  }
  function renderSummary(container, model, state, changes) {
    container.replaceChildren();
    if (state.mode !== model.mode)
      container.append(
        node(
          'p',
          'summary-message',
          `操作模式：${model.mode === 'complete' ? '补全' : '更新'} → ${state.mode === 'complete' ? '补全' : '更新'}`,
        ),
      );
    for (const change of changes) {
      const original = model.entries.find((entry) => entry.key === change.key);
      const section = node('section', 'summary-entry');
      section.append(node('h3', 'summary-key', change.key));
      const diff = (title, oldValue, newValue) => {
        const item = node('div', 'summary-change');
        item.append(
          node('span', 'summary-label', title),
          node('div', 'diff-before', `原：${oldValue}`),
          node('div', 'diff-after', `新：${newValue}`),
        );
        return item;
      };
      const note = (title, value) => {
        const item = node('div', 'summary-note');
        item.append(node('strong', '', title), node('span', '', value));
        return item;
      };
      if (change.newKey)
        section.append(diff('KEY 修改', change.key, change.newKey));
      if (change.note) section.append(note('词条评论', change.note));
      const other = node('details', 'summary-other');
      const otherLocales = model.locales.filter(
        (locale) =>
          !['en_US', 'zh_CN'].includes(locale) &&
          (change.translations?.[locale] !== undefined ||
            change.translationNotes?.[locale]),
      );
      other.append(
        node('summary', '', `其他 ${otherLocales.length} 种语言的修改 / 评论`),
      );
      for (const locale of ['en_US', 'zh_CN', ...otherLocales]) {
        const target = ['en_US', 'zh_CN'].includes(locale) ? section : other;
        if (change.translations?.[locale] !== undefined)
          target.append(
            diff(
              label(locale),
              original.translations[locale],
              change.translations[locale],
            ),
          );
        if (change.translationNotes?.[locale])
          target.append(
            note(
              `${label(locale)} · 译文评论`,
              change.translationNotes[locale],
            ),
          );
      }
      if (otherLocales.length) section.append(other);
      container.append(section);
    }
    if (!changes.length && state.mode === model.mode)
      container.append(
        node(
          'p',
          'summary-message',
          model.applied
            ? '当前方案已上传，未产生新的修改。无需重复上传。'
            : `确认当前方案中的 ${model.entries.length} 个词条、${model.locales.length} 种语言。`,
        ),
      );
  }
  return {
    node,
    resize,
    resizeVisible,
    activateHelp,
    buildCard,
    renderSummary,
  };
}

module.exports = createReviewUi;
