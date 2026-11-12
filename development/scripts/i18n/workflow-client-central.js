// Workflow client backed by a local OneKeyHQ/onekey-i18n checkout. It offers the
// interface the workflow used with Lokalise (project, findKey, create,
// updateTranslation, request) so scan, preview, approval and apply stay the same.
// Reads use the checkout's canonical files; writes go through its CLI
// (tools/i18n.mjs) so onekey-i18n's validation and formatting apply.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PROJECT_ID, PROJECT_SLUG, centralDir, git } = require('./central');
const { localKey } = require('./workflow-data');

// A translation is addressed by [language, ref]; refs may contain ":" or ".".
const translationId = (ref, iso) => JSON.stringify([iso, ref]);

function parseTranslationId(id) {
  const parsed = JSON.parse(id);
  if (!Array.isArray(parsed) || parsed.length !== 2)
    throw new Error(`Invalid translation id ${id}.`);
  return { iso: parsed[0], ref: parsed[1] };
}

class CentralClient {
  constructor({ dir = centralDir(), run } = {}) {
    this.dir = dir;
    this.projectId = PROJECT_ID;
    this.projectDir = path.join(dir, 'projects', PROJECT_SLUG);
    this.run =
      run ||
      ((args) =>
        execFileSync(
          process.execPath,
          [path.join(dir, 'tools', 'i18n.mjs'), ...args],
          { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ));
    this.cache = null;
  }

  readJson(relative) {
    return JSON.parse(
      fs.readFileSync(path.join(this.projectDir, relative), 'utf8'),
    );
  }

  load() {
    if (!this.cache) {
      const project = this.readJson('project.json');
      this.cache = {
        project,
        keyMeta: this.readJson('keys.json'),
        locales: Object.fromEntries(
          project.languages.map(({ iso }) => [
            iso,
            this.readJson(`locales/${iso}.json`),
          ]),
        ),
      };
    }
    return this.cache;
  }

  async project(expectedName) {
    const { project } = this.load();
    if (expectedName && project.name !== expectedName)
      throw new Error(
        `onekey-i18n project "${project.name}" differs from "${expectedName}". No changes were made.`,
      );
    return {
      id: this.projectId,
      name: project.name,
      languages: project.languages.map(({ iso, name }) => ({
        lang_iso: iso,
        lang_name: name,
      })),
    };
  }

  async findKey(key) {
    const { project, keyMeta, locales } = this.load();
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

  assertWritableBranch() {
    const branch = git(this.dir, ['branch', '--show-current']);
    if (!branch || ['main', 'master'].includes(branch))
      throw new Error(
        `Switch ${this.dir} to a branch before applying, e.g. git -C ${this.dir} switch -c i18n/<topic> origin/main.`,
      );
  }

  write(ref, values) {
    this.assertWritableBranch();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-values-'));
    try {
      const file = path.join(tmp, 'values.json');
      fs.writeFileSync(file, JSON.stringify(values));
      this.run(['set', PROJECT_SLUG, ref, '--values', file]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      this.cache = null;
    }
  }

  async create(entry, localeMap) {
    this.write(
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
    this.write(ref, { [iso]: value });
  }

  remove(ref) {
    this.assertWritableBranch();
    try {
      this.run(['remove', PROJECT_SLUG, ref]);
    } finally {
      this.cache = null;
    }
  }

  // Only the read that apply uses to detect concurrent edits.
  async request(method, url) {
    const match = /^\/translations\/(.+)$/.exec(url);
    if (method !== 'GET' || !match)
      throw new Error(`Unsupported onekey-i18n request: ${method} ${url}`);
    const id = decodeURIComponent(match[1]);
    const { iso, ref } = parseTranslationId(id);
    const { locales } = this.load();
    return {
      data: {
        translation: {
          translation_id: id,
          translation: locales[iso]?.[ref] ?? '',
        },
      },
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

module.exports = { CentralClient, translationRecords, translationId };
