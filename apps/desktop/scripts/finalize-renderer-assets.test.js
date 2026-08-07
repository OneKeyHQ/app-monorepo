/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectJavaScriptFiles,
  verifyProductionRendererExcludesDevelopmentModules,
} = require('./finalize-renderer-assets');

describe('Desktop production renderer verification', () => {
  let fixtureDir;

  beforeEach(() => {
    fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-desktop-renderer-'),
    );
  });

  afterEach(() => {
    fs.rmSync(fixtureDir, { force: true, recursive: true });
  });

  test('accepts JavaScript without development-only modules', () => {
    const nestedDir = path.join(fixtureDir, 'static', 'js');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'main.js'), 'console.log("OneKey")');
    fs.writeFileSync(path.join(nestedDir, 'chunk.js'), 'export default 1');
    fs.writeFileSync(path.join(nestedDir, 'ignored.css'), 'CustomInjection');

    expect(collectJavaScriptFiles(fixtureDir)).toHaveLength(2);
    expect(() =>
      verifyProductionRendererExcludesDevelopmentModules(fixtureDir),
    ).not.toThrow();
  });

  test('rejects a development-only marker in a nested chunk', () => {
    const nestedDir = path.join(fixtureDir, 'static', 'js');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(
      path.join(nestedDir, 'chunk.js'),
      'const feature = "custom-injected";',
    );

    expect(() =>
      verifyProductionRendererExcludesDevelopmentModules(fixtureDir),
    ).toThrow('static/js/chunk.js: custom-injected');
  });
});
