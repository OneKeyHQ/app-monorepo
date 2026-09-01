/* cspell:words prebundle */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getInputKey,
  getReleaseTag,
  hashFiles,
} = require('../web-embed-prebundle');

describe('web-embed-prebundle', () => {
  let temporaryDirectory;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-web-embed-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('derives a stable immutable tag from the checkout inputs', () => {
    const inputKey = getInputKey();

    expect(inputKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(getInputKey()).toBe(inputKey);
    expect(getReleaseTag()).toBe(`web-embed-prebundle-v1-${inputKey}`);
  });

  it('binds a tree digest to relative paths and file contents', () => {
    const firstPath = path.join(temporaryDirectory, 'first.txt');
    const secondPath = path.join(temporaryDirectory, 'nested/second.txt');
    fs.mkdirSync(path.dirname(secondPath), { recursive: true });
    fs.writeFileSync(firstPath, 'first');
    fs.writeFileSync(secondPath, 'second');

    const digest = hashFiles([firstPath, secondPath], temporaryDirectory);
    expect(hashFiles([firstPath, secondPath], temporaryDirectory)).toBe(digest);

    fs.writeFileSync(secondPath, 'changed');
    expect(hashFiles([firstPath, secondPath], temporaryDirectory)).not.toBe(
      digest,
    );
  });
});
