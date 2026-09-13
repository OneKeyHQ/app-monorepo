const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');

const {
  gitInfo,
  isCommitHash,
} = require('@lavamoat/git-safe-dependencies/src/isgit');
const {
  ValidateGitUrl,
} = require('@lavamoat/git-safe-dependencies/src/validate-git');

test('the Git checker normalizes only complete Yarn commit selectors', () => {
  const sha = 'a'.repeat(40);
  assert.equal(
    gitInfo(`https://github.com/example/package.git#commit=${sha}`).committish,
    sha,
  );
  for (const selector of [
    'commit=abc123',
    `commit=${sha}&workspace=other`,
    `commit=${sha}&commit=${'b'.repeat(40)}`,
    `commit=${sha}suffix`,
  ]) {
    assert.equal(
      isCommitHash(
        gitInfo(`https://github.com/example/package.git#${selector}`)
          .committish,
      ),
      false,
    );
  }
});

test('scoped Git dependencies retain direct manifest-versus-lockfile SHA checks', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ branches: ['main'] }),
    };
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const repository = `https://github.com/fixture/package-${randomUUID()}.git`;
  const specified = 'a'.repeat(40);
  const resolved = 'b'.repeat(40);
  const validator = new ValidateGitUrl({
    cacheOnDisk: false,
    packages: {
      [`@fixture/package@${repository}#${specified}`]: {
        resolved: `${repository}#commit=${resolved}`,
      },
    },
  });
  const result = await validator.validate({
    '@fixture/package': `${repository}#${specified}`,
  });
  assert.equal(result.type, 'error');
  assert.equal(result.errors[0].package, '@fixture/package');
  assert.match(result.errors[0].message, /mismatch/);
  assert.deepEqual(requests, []);
});

test('normalized full SHAs still require GitHub branch or tag provenance', async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let belongsToRepository = false;
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        branches: belongsToRepository ? ['main'] : [],
        tags: [],
      }),
    };
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const sha = 'c'.repeat(40);
  for (const shouldBelong of [false, true]) {
    belongsToRepository = shouldBelong;
    const repository = `https://github.com/fixture/package-${randomUUID()}`;
    const validator = new ValidateGitUrl({
      cacheOnDisk: false,
      packages: {
        [`@fixture/package@${repository}#${sha}`]: {
          resolved: `${repository}.git#commit=${sha}`,
        },
      },
    });
    const result = await validator.validate({
      '@fixture/package': `${repository}.git#${sha}`,
    });
    assert.equal(result.type, shouldBelong ? 'success' : 'error');
    if (!shouldBelong)
      assert.match(
        result.errors[0].message,
        /does not exist in the repository/,
      );
    assert.equal(requests.at(-1), `${repository}/branch_commits/${sha}`);
  }
});
