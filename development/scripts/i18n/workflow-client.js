// cspell:ignore automations nextcursor
const { setTimeout: delay } = require('node:timers/promises');

const { localKey } = require('./workflow-data');

class LokaliseClient {
  constructor({ token, projectId, fetchImpl = fetch, wait = delay }) {
    if (!token || !projectId)
      throw new Error(
        'LOKALISE_TOKEN and LOKALISE_PROJECT_ID are required. Use yarn op, keychain, or oenv.',
      );
    this.token = token;
    this.projectId = projectId;
    this.fetch = fetchImpl;
    this.wait = wait;
    this.base = `https://api.lokalise.com/api2/projects/${encodeURIComponent(projectId)}`;
  }

  async request(method, suffix = '', body, attempt = 0) {
    await this.wait(180);
    let response;
    try {
      response = await this.fetch(`${this.base}${suffix}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'X-Api-Token': this.token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      if (method === 'GET' && attempt < 2) {
        await this.wait(500 * 2 ** attempt);
        return this.request(method, suffix, body, attempt + 1);
      }
      throw new Error(
        `Lokalise ${method} request failed or timed out. ${method === 'GET' ? 'Retry the command.' : 'The write may have completed; rerun the approved plan to reconcile it.'}`,
      );
    }
    if (
      method === 'GET' &&
      (response.status === 429 || response.status >= 500) &&
      attempt < 2
    ) {
      const seconds = Number(response.headers.get('retry-after'));
      if (seconds > 30)
        throw new Error('Lokalise rate limited this request; retry later.');
      await this.wait(
        Number.isFinite(seconds) && seconds > 0
          ? seconds * 1000
          : 500 * 2 ** attempt,
      );
      return this.request(method, suffix, body, attempt + 1);
    }
    if (!response.ok)
      throw new Error(
        `Lokalise ${method} failed (HTTP ${response.status}); no automatic write retry was attempted.`,
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        'Lokalise returned invalid JSON. Reconcile before retrying a write.',
      );
    }
    if (data.error || data.errors?.length)
      throw new Error(
        'Lokalise reported an API or partial-write error. Reconcile the approved plan before retrying.',
      );
    return { data, headers: response.headers };
  }

  async project(expectedName) {
    const { data: project } = await this.request('GET');
    if (
      project.project_id !== this.projectId ||
      !project.name ||
      (expectedName && project.name !== expectedName)
    )
      throw new Error(
        'Lokalise project identity mismatch. No changes were made.',
      );
    const languages = [];
    for (let page = 1; page <= 100; page += 1) {
      const { data } = await this.request(
        'GET',
        `/languages?limit=500&page=${page}`,
      );
      if (!Array.isArray(data.languages))
        throw new Error('Invalid Lokalise language response.');
      languages.push(...data.languages);
      if (data.languages.length < 500)
        return { id: project.project_id, name: project.name, languages };
    }
    throw new Error('Lokalise language pagination limit exceeded.');
  }

  async findKey(key) {
    const variants = [
      ...new Set([key, localKey(key), localKey(key).replaceAll('.', '::')]),
    ];
    const found = new Map();
    const cursors = new Set();
    let cursor = '';
    do {
      const query = new URLSearchParams({
        filter_keys: variants.join(','),
        include_translations: '1',
        disable_references: '1',
        pagination: 'cursor',
        limit: '500',
      });
      if (cursor) query.set('cursor', cursor);
      const { data, headers } = await this.request('GET', `/keys?${query}`);
      if (!Array.isArray(data.keys))
        throw new Error('Invalid Lokalise keys response.');
      for (const item of data.keys) {
        const names =
          typeof item.key_name === 'string'
            ? [item.key_name]
            : Object.values(item.key_name || {});
        if (names.some((name) => variants.includes(name)))
          found.set(String(item.key_id), item);
      }
      cursor =
        headers.get('x-pagination-next-cursor') ||
        headers.get('nextcursor') ||
        headers.get('next-cursor') ||
        headers.get('x-next-cursor') ||
        '';
      if (cursor && cursors.has(cursor))
        throw new Error('Lokalise pagination cursor repeated.');
      cursors.add(cursor);
      if (cursors.size > 100)
        throw new Error('Lokalise key pagination limit exceeded.');
    } while (cursor);
    if (found.size > 1)
      throw new Error(
        `Ambiguous remote key variants for ${key}. Specify and resolve the duplicate in Lokalise.`,
      );
    const result = [...found.values()][0];
    if (
      result &&
      typeof result.key_name !== 'string' &&
      result.key_name.web !== key &&
      localKey(result.key_name.web || '') !== localKey(key)
    )
      throw new Error(
        `${key}: per-platform key names differ; the web key must match the repository.`,
      );
    return result || null;
  }

  async create(entry, localeMap) {
    return this.request('POST', '/keys', {
      keys: [
        {
          key_name: entry.key,
          platforms: ['web'],
          translations: Object.entries(localeMap).map(([locale, iso]) => ({
            language_iso: iso,
            translation: entry.translations[locale],
          })),
        },
      ],
      use_automations: false,
    });
  }

  async updateTranslation(id, value) {
    return this.request('PUT', `/translations/${encodeURIComponent(id)}`, {
      translation: value,
    });
  }
}

function translationRecords(key, localeMap) {
  if (!key) return null;
  if (key.is_plural)
    throw new Error(
      'Structured Lokalise plural keys require a separate migration; ICU string messages are supported.',
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

module.exports = { LokaliseClient, translationRecords };
