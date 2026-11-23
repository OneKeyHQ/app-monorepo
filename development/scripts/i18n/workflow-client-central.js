// Workflow client for OneKeyHQ/onekey-i18n over the GitHub API; no checkout.
// It reads the canonical app data of the latest release (app.source.zip), or
// of a commit such as a copy PR's when verifying, applies edits in memory, and finalize() commits the changed files to a new
// branch and opens a pull request there. The interface the workflow used with
// Lokalise (project, findKey, create, updateTranslation, request) is kept, so
// scan, preview and approval are unchanged.

const crypto = require('node:crypto');

const {
  CENTRAL_REPO,
  PROJECT_SLUG,
  githubApi,
  sourceFromCommit,
  sourceFromRelease,
} = require('./central');
const { localKey } = require('./workflow-data');

const PROJECT_PATH = `projects/${PROJECT_SLUG}`;
// Bound the encoded HTTP body, not the size of the source JSON files.
const MAX_COMMIT_BYTES = 3 * 1024 * 1024;

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
const proposalOf = (pull, branch, commit, files) => ({
  number: pull.number,
  url: pull.html_url,
  author: pull.user?.login ?? null,
  branch,
  commit,
  files,
});

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
    // Release channel the copy is read from: app-latest, or app-test.
    channel = process.env.ONEKEY_I18N_CHANNEL || 'latest',
    // An onekey-i18n commit to read instead of the release, e.g. a copy PR's.
    ref,
    maxCommitBytes = MAX_COMMIT_BYTES,
  } = {}) {
    this.api = api;
    this.base = base;
    this.channel = channel;
    this.ref = ref;
    this.maxCommitBytes = maxCommitBytes;
    // { tag, commit, files } of app.source.zip; injected by tests.
    this.source = source;
    this.state = null;
    this.changed = new Set();
  }

  async load() {
    if (!this.state) {
      this.source =
        this.source ||
        (this.ref
          ? await sourceFromCommit({ commit: this.ref, api: this.api })
          : await sourceFromRelease({ api: this.api, channel: this.channel }));
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

  /** [ref, meta] of every key named this key or one of its variants. */
  async keysNamed(key) {
    const { keyMeta } = await this.load();
    const variants = new Set([
      key,
      localKey(key),
      localKey(key).replaceAll('.', '::'),
    ]);
    return Object.entries(keyMeta).filter(([ref, meta]) =>
      variants.has(meta.name ?? ref),
    );
  }

  /** Archived keys that use this name; a new key cannot take it. */
  async archivedRefs(key) {
    return (await this.keysNamed(key))
      .filter(([, meta]) => meta.archived)
      .map(([ref]) => ref);
  }

  async findKey(key) {
    const { project, locales } = await this.load();
    const found = (await this.keysNamed(key)).filter(
      ([, meta]) => !meta.archived,
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
      // As onekey-i18n's own editor writes it: no creation time, so a rerun
      // of the same plan builds the same keys.json.
      state.keyMeta[ref] = {
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
   * overwritten. With a key (apply passes its approval) the branch is named
   * after it, so a rerun reuses the PR an earlier run opened even if GitHub's
   * answer was lost, or opens it from the branch that run created, but only
   * while that branch holds exactly this change, a verified batch prefix, or
   * nothing yet. A branch holding commits of its own is never moved. Returns null without changes.
   *
   * main requires signed commits. GitHub signs commits made through GraphQL
   * createCommitOnBranch with the developer's own token, but not commits made
   * through the REST git/commits endpoint, so the branch is created first and
   * the commit is added to it.
   */
  async finalize({ title, body, branchHint = PROJECT_SLUG, key }) {
    if (this.changed.size === 0) return null;
    const repo = `/repos/${CENTRAL_REPO}`;
    const files = [...this.changed].toSorted();
    const named = key ? `i18n/${branchHint}-${key}` : null;
    const changeId = this.changeId(files, 64);
    const branch = named ?? `i18n/${branchHint}-${changeId.slice(0, 7)}`;
    if (named) {
      const owner = CENTRAL_REPO.split('/')[0];
      const [open] = await this.api.get(
        `${repo}/pulls?state=open&base=${encodeURIComponent(this.base)}&head=${encodeURIComponent(`${owner}:${named}`)}`,
      );
      if (open) {
        // Copy pushed to that PR since would otherwise ride on this approval.
        const held = await this.commitHoldingChange(repo, named, files, {
          title,
          changeId,
        });
        if (!held)
          throw new Error(
            `onekey-i18n PR #${open.number} (${named}) no longer holds exactly this plan's change. Review it, then close it or prepare a new plan.`,
          );
        await this.checkBranchHead(repo, named, held);
        const current = await this.api.get(`${repo}/pulls/${open.number}`);
        this.checkPull(current, held);
        this.changed.clear();
        return proposalOf(current, named, held, files);
      }
    }
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
    const batches = this.commitBatches(files, { branch, title, changeId });
    let completedBatches = 0;
    let parent = head;
    let proposed = null;
    try {
      await this.api.request('POST', `${repo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: head,
      });
    } catch (error) {
      if (!named || error.status !== 422) throw error;
      const owner = CENTRAL_REPO.split('/')[0];
      const [existingPull] = await this.api.get(
        `${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
      );
      if (existingPull)
        throw new Error(
          `onekey-i18n branch ${branch} already has an open PR #${existingPull.number} (${existingPull.html_url}). Review it before resuming this plan; no commits were appended.`,
          { cause: error },
        );
      // The branch exists without an open PR (an earlier run that did not
      // open it, or did not get to commit). Use it as is; moving it would drop
      // whatever was pushed there.
      const compared = await this.api.get(
        `${repo}/compare/${this.base}...${branch}`,
      );
      proposed = this.commitHoldingChangeIn(compared, files);
      const progress = proposed
        ? null
        : await this.batchProgress(repo, compared, batches, changeId);
      if (progress) {
        completedBatches = progress.completed;
        parent = progress.commit;
        if (completedBatches === batches.length) proposed = parent;
      }
      if (!proposed && !progress && compared.ahead_by !== 0)
        throw new Error(
          `onekey-i18n branch ${branch} already exists without an open PR and holds other content. Inspect it and any PR it had, delete it if it is stale, then rerun apply.`,
          { cause: error },
        );
      // Nothing on it yet: its tip is an older commit of the base. Bring it to
      // the base checked above (a fast-forward, refused if anything was pushed).
      if (!proposed && !progress && compared.merge_base_commit.sha !== head)
        await this.api.request('PATCH', `${repo}/git/refs/heads/${branch}`, {
          sha: head,
          force: false,
        });
    }
    if (!proposed) {
      for (let index = completedBatches; index < batches.length; index += 1) {
        parent = await this.commitOnBranch({
          branch,
          parent,
          title,
          files: batches[index],
          body:
            batches.length > 1
              ? this.batchMarker(changeId, index, batches.length)
              : undefined,
        });
      }
      proposed = parent;
    }
    await this.checkBranchHead(repo, branch, proposed);
    const pull = await this.api.request('POST', `${repo}/pulls`, {
      title,
      head: branch,
      base: this.base,
      body,
    });
    this.checkPull(pull, proposed);
    this.changed.clear();
    return proposalOf(pull, branch, proposed, files);
  }

  async checkBranchHead(repo, branch, expected) {
    const ref = await this.api.get(`${repo}/git/ref/heads/${branch}`);
    if (ref.object.sha !== expected)
      throw new Error(
        `onekey-i18n branch ${branch} moved after verification. Review it before rerunning apply.`,
      );
  }

  checkPull(pull, expected) {
    if (
      pull.base?.ref !== this.base ||
      (pull.state !== 'open' && pull.merged !== true)
    )
      throw new Error(
        `onekey-i18n PR #${pull.number} (${pull.html_url}) needs review: it must target ${this.base} and remain open or merged. No success receipt was recorded.`,
      );
    if (pull.head?.sha !== expected)
      throw new Error(
        `onekey-i18n PR #${pull.number} (${pull.html_url}) needs review: its head differs from the verified commit ${expected}. No success receipt was recorded.`,
      );
  }

  /**
   * The commit on `branch` that holds exactly this change: one legacy commit
   * or a complete verified batch sequence. Null when the branch contains
   * any other changes or an incomplete batch sequence.
   */
  async commitHoldingChange(repo, branch, files, { title, changeId }) {
    const compared = await this.api.get(
      `${repo}/compare/${this.base}...${branch}`,
    );
    const single = this.commitHoldingChangeIn(compared, files);
    if (single) return single;
    const batches = this.commitBatches(files, { branch, title, changeId });
    const progress = await this.batchProgress(
      repo,
      compared,
      batches,
      changeId,
    );
    return progress?.completed === batches.length ? progress.commit : null;
  }

  commitHoldingChangeIn(compared, files) {
    const onBranch = Object.fromEntries(
      compared.files.map((item) => [item.filename, item.sha]),
    );
    const exact =
      compared.ahead_by === 1 &&
      compared.files.length === files.length &&
      files.every(
        (file) =>
          onBranch[`${PROJECT_PATH}/${file}`] === blobSha(this.fileText(file)),
      );
    return exact ? compared.commits.at(-1).sha : null;
  }

  /** Short id of this change (paths and contents), for branch names without a plan key. */
  changeId(files, length = 7) {
    const hash = crypto.createHash('sha256');
    for (const file of files) hash.update(`${file}\0${this.fileText(file)}\0`);
    return hash.digest('hex').slice(0, length);
  }

  commitBatches(files, { branch, title, changeId }) {
    // The marker includes the total batch count. Repack until that count is
    // stable, measuring the same request that will be sent to GitHub.
    let total = 1;
    for (;;) {
      const batchCount = total;
      const batches = [];
      let batch = [];
      const fits = (candidate) =>
        Buffer.byteLength(
          JSON.stringify(
            this.commitRequest({
              branch,
              title,
              parent: '0'.repeat(40),
              files: candidate,
              body:
                batchCount > 1
                  ? this.batchMarker(changeId, batches.length, batchCount)
                  : undefined,
            }),
          ),
        ) <= this.maxCommitBytes;
      for (const file of files) {
        if (!fits([...batch, file])) {
          if (batch.length) batches.push(batch);
          batch = [];
          if (!fits([file]))
            throw new Error(
              `${file} exceeds the signed commit request limit; no files were uploaded.`,
            );
        }
        batch.push(file);
      }
      if (batch.length) batches.push(batch);
      if (batches.length === total) return batches;
      total = batches.length;
    }
  }

  commitAddition(file) {
    return {
      path: `${PROJECT_PATH}/${file}`,
      contents: Buffer.from(this.fileText(file), 'utf8').toString('base64'),
    };
  }

  batchMarker(changeId, index, total) {
    return `OneKey-i18n-batch: ${changeId}:${index + 1}/${total}`;
  }

  // Resume only an exact prefix of this plan's batches. Check each commit,
  // not just the final tree: an unrelated edit must not ride along in history.
  async batchProgress(repo, compared, batches, changeId) {
    const count = compared.ahead_by;
    if (
      batches.length < 2 ||
      !count ||
      count > batches.length ||
      compared.commits?.length !== count ||
      !compared.merge_base_commit?.sha
    )
      return null;
    const expectedFiles = batches.slice(0, count).flat();
    if (!this.filesMatch(compared.files, expectedFiles)) return null;
    let parent = compared.merge_base_commit.sha;
    for (let index = 0; index < count; index += 1) {
      const summary = compared.commits[index];
      const marker = this.batchMarker(changeId, index, batches.length);
      if (!summary.commit?.message?.trimEnd().endsWith(`\n\n${marker}`))
        return null;
      const commit = await this.api.get(`${repo}/commits/${summary.sha}`);
      if (
        commit.commit?.verification?.verified !== true ||
        !commit.commit?.tree?.sha ||
        commit.parents?.length !== 1 ||
        commit.parents[0].sha !== parent ||
        !commit.commit?.message?.trimEnd().endsWith(`\n\n${marker}`) ||
        !this.filesMatch(commit.files, batches[index])
      )
        return null;
      const tree = await this.api.get(
        `${repo}/git/trees/${commit.commit.tree.sha}?recursive=1`,
      );
      if (
        tree.truncated ||
        !batches[index].every((file) =>
          tree.tree?.some(
            (entry) =>
              entry.path === `${PROJECT_PATH}/${file}` &&
              entry.type === 'blob' &&
              entry.mode === '100644' &&
              entry.sha === blobSha(this.fileText(file)),
          ),
        )
      )
        return null;
      parent = summary.sha;
    }
    return { completed: count, commit: parent };
  }

  filesMatch(actual, expected) {
    return (
      actual?.length === expected.length &&
      expected.every((file) =>
        actual.some(
          (item) =>
            item.filename === `${PROJECT_PATH}/${file}` &&
            item.sha === blobSha(this.fileText(file)) &&
            item.status !== 'removed' &&
            !item.previous_filename,
        ),
      )
    );
  }

  commitRequest({ branch, parent, title, files, body }) {
    return {
      query:
        'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
      variables: {
        input: {
          branch: { repositoryNameWithOwner: CENTRAL_REPO, branchName: branch },
          expectedHeadOid: parent,
          message: { headline: title, ...(body ? { body } : {}) },
          fileChanges: {
            additions: files.map((file) => this.commitAddition(file)),
          },
        },
      },
    };
  }

  /**
   * Add one commit holding the changed files on top of `parent`, the current
   * tip of `branch`, through GraphQL so that GitHub signs it.
   */
  async commitOnBranch(options) {
    const { branch } = options;
    const request = this.commitRequest(options);
    if (Buffer.byteLength(JSON.stringify(request)) > this.maxCommitBytes)
      throw new Error('Signed commit request exceeds its byte limit.');
    const { data, errors } = await this.api.request(
      'POST',
      '/graphql',
      request,
    );
    const oid = data?.createCommitOnBranch?.commit?.oid;
    if (errors?.length || !oid)
      throw new Error(
        `onekey-i18n commit on ${branch} failed: ${
          errors?.map((item) => item.message).join('; ') || 'no commit returned'
        }. Rerun apply; it continues on the same branch.`,
      );
    return oid;
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
