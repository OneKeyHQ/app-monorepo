// Workflow client for OneKeyHQ/onekey-i18n over the GitHub API; no checkout.
// It reads the canonical app data of the latest release (app.source.zip),
// applies edits in memory, and finalize() commits the changed files to a new
// branch and opens a pull request there. The interface the workflow used with
// Lokalise (project, findKey, create, updateTranslation, request) is kept, so
// scan, preview and approval are unchanged.

const crypto = require('node:crypto');

const {
  CENTRAL_REPO,
  PROJECT_SLUG,
  githubApi,
  sourceFromRelease,
} = require('./central');
const { localKey } = require('./workflow-data');

const PROJECT_PATH = `projects/${PROJECT_SLUG}`;

// A translation is addressed by [language, ref]; refs may contain ":" or ".".
const translationId = (ref, iso) => JSON.stringify([iso, ref]);

function parseTranslationId(id) {
  const parsed = JSON.parse(id);
  if (!Array.isArray(parsed) || parsed.length !== 2)
    throw new Error(`Invalid translation id ${id}.`);
  return { iso: parsed[0], ref: parsed[1] };
}

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, sortKeysDeep(value[key])]),
    );
  return value;
}

/** onekey-i18n's canonical JSON: sorted keys, two-space indent, trailing newline. */
const toStableJson = (value) =>
  `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;

/** Git blob id of a file, to compare with the tree of the base branch. */
function blobSha(text) {
  const data = Buffer.from(text, 'utf8');
  return crypto
    .createHash('sha1')
    .update(`blob ${data.length}\0`)
    .update(data)
    .digest('hex');
}

/** keys.json ref of a key: its name, or "<name>@@<key_id>" for mirrored duplicates. */
function resolveRef(keyMeta, name) {
  if (keyMeta[name]) return name;
  const matches = Object.keys(keyMeta).filter(
    (ref) => keyMeta[ref].name === name,
  );
  if (matches.length > 1)
    throw new Error(
      `"${name}" is shared by several keys in onekey-i18n (${matches.join(', ')}); resolve the duplicate there first.`,
    );
  return matches[0] ?? null;
}

class CentralClient {
  constructor({
    api = githubApi(),
    source,
    // Branch that copy PRs target. Another branch only to try unmerged
    // onekey-i18n changes end to end; its CI must build the PR preview.
    base = process.env.ONEKEY_I18N_BASE || 'main',
  } = {}) {
    this.api = api;
    this.base = base;
    // { tag, commit, files } of app.source.zip; injected by tests.
    this.source = source;
    this.state = null;
    this.changed = new Set();
  }

  async load() {
    if (!this.state) {
      this.source = this.source || (await sourceFromRelease({ api: this.api }));
      const parse = (name) => JSON.parse(this.source.files[name]);
      const project = parse('project.json');
      this.state = {
        project,
        keyMeta: parse('keys.json'),
        review: this.source.files['review.json'] ? parse('review.json') : null,
        locales: Object.fromEntries(
          project.languages.map(({ iso }) => [
            iso,
            parse(`locales/${iso}.json`),
          ]),
        ),
      };
    }
    return this.state;
  }

  async project() {
    const { project } = await this.load();
    return {
      name: project.name,
      languages: project.languages.map(({ iso, name }) => ({
        lang_iso: iso,
        lang_name: name,
      })),
    };
  }

  async findKey(key) {
    const { project, keyMeta, locales } = await this.load();
    const variants = new Set([
      key,
      localKey(key),
      localKey(key).replaceAll('.', '::'),
    ]);
    const found = Object.entries(keyMeta).filter(
      ([ref, meta]) => !meta.archived && variants.has(meta.name ?? ref),
    );
    if (found.length > 1)
      throw new Error(
        `Ambiguous key variants for ${key} in onekey-i18n: ${found
          .map(([ref]) => ref)
          .join(', ')}. Resolve the duplicate there first.`,
      );
    if (!found.length) return null;
    const [ref, meta] = found[0];
    return {
      key_id: ref,
      key_name: { web: meta.name ?? ref },
      is_plural: Boolean(meta.plural),
      translations: project.languages.map(({ iso }) => ({
        translation_id: translationId(ref, iso),
        language_iso: iso,
        translation: locales[iso][ref] ?? '',
      })),
    };
  }

  updateKeyCount(state) {
    const keyCount = Object.values(state.keyMeta).filter(
      (meta) => !meta.archived,
    ).length;
    if (state.project.keyCount !== keyCount) {
      state.project.keyCount = keyCount;
      this.changed.add('project.json');
    }
  }

  /** Set text per language; "" or null removes that language's text. */
  async setValues(name, values) {
    const state = await this.load();
    let ref = resolveRef(state.keyMeta, name);
    if (ref === null) {
      const base = state.project.source.baseLanguage;
      if (!values[base])
        throw new Error(
          `${name}: a new key needs base language (${base}) text.`,
        );
      ref = name;
      state.keyMeta[ref] = {
        createdAt: new Date().toISOString(),
        platforms: ['web'],
        ...(isPlainObject(values[base]) ? { plural: true } : {}),
      };
      this.changed.add('keys.json');
    } else if (state.keyMeta[ref].archived) {
      throw new Error(`${name} is archived in onekey-i18n.`);
    }
    for (const [iso, value] of Object.entries(values)) {
      const locale = state.locales[iso];
      if (!locale)
        throw new Error(
          `${name}: "${iso}" is not a language of onekey-i18n ${PROJECT_SLUG}.`,
        );
      const next = value === '' || value === null ? undefined : value;
      if (JSON.stringify(locale[ref]) !== JSON.stringify(next)) {
        if (next === undefined) delete locale[ref];
        else locale[ref] = next;
        this.changed.add(`locales/${iso}.json`);
      }
    }
    this.updateKeyCount(state);
  }

  async create(entry, localeMap) {
    await this.setValues(
      entry.key,
      Object.fromEntries(
        Object.entries(localeMap).map(([locale, iso]) => [
          iso,
          entry.translations[locale],
        ]),
      ),
    );
  }

  async updateTranslation(id, value) {
    const { iso, ref } = parseTranslationId(id);
    await this.setValues(ref, { [iso]: value });
  }

  async remove(name) {
    const state = await this.load();
    const ref = resolveRef(state.keyMeta, name);
    if (ref === null) throw new Error(`${name} does not exist in onekey-i18n.`);
    if (state.keyMeta[ref].archived)
      throw new Error(
        `${name} is archived; remove it in onekey-i18n directly.`,
      );
    delete state.keyMeta[ref];
    this.changed.add('keys.json');
    for (const [iso, locale] of Object.entries(state.locales)) {
      if (Object.hasOwn(locale, ref)) {
        delete locale[ref];
        this.changed.add(`locales/${iso}.json`);
      }
    }
    for (const lists of Object.values(state.review ?? {})) {
      for (const list of ['reviewed', 'unverified']) {
        const index = lists[list]?.indexOf(ref) ?? -1;
        if (index !== -1) {
          lists[list].splice(index, 1);
          this.changed.add('review.json');
        }
      }
    }
    this.updateKeyCount(state);
  }

  // Only the read that apply uses to detect concurrent edits.
  async request(method, url) {
    const match = /^\/translations\/(.+)$/.exec(url);
    if (method !== 'GET' || !match)
      throw new Error(`Unsupported onekey-i18n request: ${method} ${url}`);
    const id = decodeURIComponent(match[1]);
    const { iso, ref } = parseTranslationId(id);
    const { locales } = await this.load();
    return {
      data: {
        translation: {
          translation_id: id,
          translation: locales[iso]?.[ref] ?? '',
        },
      },
    };
  }

  fileText(file) {
    const { project, keyMeta, review, locales } = this.state;
    if (file === 'project.json') return toStableJson(project);
    if (file === 'keys.json') return toStableJson(keyMeta);
    if (file === 'review.json') return toStableJson(review);
    return toStableJson(locales[/^locales\/(.+)\.json$/.exec(file)[1]]);
  }

  /**
   * Commit the changed files to a new onekey-i18n branch and open a PR
   * against the base branch (main). Refuses when the base changed any of those
   * files after the release that was read, so nobody else's edit is
   * overwritten. Returns null without changes.
   */
  async finalize({ title, body, branchHint = PROJECT_SLUG }) {
    if (this.changed.size === 0) return null;
    const repo = `/repos/${CENTRAL_REPO}`;
    const files = [...this.changed].toSorted();
    const head = (await this.api.get(`${repo}/git/ref/heads/${this.base}`))
      .object.sha;
    if (head !== this.source.commit) {
      const listing = [
        ...(await this.api.get(`${repo}/contents/${PROJECT_PATH}?ref=${head}`)),
        ...(await this.api.get(
          `${repo}/contents/${PROJECT_PATH}/locales?ref=${head}`,
        )),
      ];
      const onBase = Object.fromEntries(
        listing.map((item) => [
          item.path.slice(PROJECT_PATH.length + 1),
          item.sha,
        ]),
      );
      const moved = files.filter(
        (file) => onBase[file] !== blobSha(this.source.files[file] ?? ''),
      );
      if (moved.length)
        throw new Error(
          `onekey-i18n ${this.base} changed ${moved.join(', ')} after ${this.source.tag} ${this.source.version}. Wait for its release, then sync and preview again.`,
        );
    }
    const baseTree = (await this.api.get(`${repo}/git/commits/${head}`)).tree
      .sha;
    const tree = [];
    for (const file of files) {
      const blob = await this.api.request('POST', `${repo}/git/blobs`, {
        content: this.fileText(file),
        encoding: 'utf-8',
      });
      tree.push({
        path: `${PROJECT_PATH}/${file}`,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }
    const newTree = await this.api.request('POST', `${repo}/git/trees`, {
      base_tree: baseTree,
      tree,
    });
    const commit = await this.api.request('POST', `${repo}/git/commits`, {
      message: title,
      tree: newTree.sha,
      parents: [head],
    });
    const branch = `i18n/${branchHint}-${commit.sha.slice(0, 7)}`;
    await this.api.request('POST', `${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
    const pull = await this.api.request('POST', `${repo}/pulls`, {
      title,
      head: branch,
      base: this.base,
      body,
    });
    this.changed.clear();
    return {
      number: pull.number,
      url: pull.html_url,
      author: pull.user?.login ?? null,
      branch,
      commit: commit.sha,
      files,
    };
  }
}

function translationRecords(key, localeMap) {
  if (!key) return null;
  if (key.is_plural)
    throw new Error(
      'Plural keys need a separate migration; ICU string messages are supported.',
    );
  const result = {};
  for (const [locale, iso] of Object.entries(localeMap)) {
    const matches = (key.translations || []).filter(
      (item) => item.language_iso === iso,
    );
    if (
      matches.length !== 1 ||
      !matches[0].translation_id ||
      typeof matches[0].translation !== 'string'
    )
      throw new Error(
        `${key.key_id}/${locale}: missing or invalid translation record. Check project language configuration.`,
      );
    result[locale] = {
      id: matches[0].translation_id,
      value: matches[0].translation,
    };
  }
  return result;
}

module.exports = {
  CentralClient,
  translationRecords,
  translationId,
  toStableJson,
  blobSha,
};
