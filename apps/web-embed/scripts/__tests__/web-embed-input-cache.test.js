const fs = require('fs');
const os = require('os');
const path = require('path');

const parser = require('@babel/parser');

const { getInputKey } = require('../web-embed-prebundle');

describe('persistent WebEmbed input scan', () => {
  let directory;
  let options;
  let parse;
  beforeEach(() => {
    directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-web-input-cache-')),
    );
    fs.writeFileSync(path.join(directory, 'entry.js'), "import './feature';\n");
    fs.writeFileSync(
      path.join(directory, 'feature.js'),
      'export const value = 1;\n',
    );
    fs.writeFileSync(path.join(directory, 'yarn.lock'), '');
    options = {
      root: directory,
      inputPaths: ['entry.js'],
      traceDependencies: true,
      resolveOptions: {
        extensions: ['.web.js', '.js'],
        aliasFields: ['browser'],
        fullySpecified: false,
      },
    };
    parse = jest.spyOn(parser, 'parse');
  });
  afterEach(() => {
    parse.mockRestore();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('reuses a disk snapshot without parsing unchanged source again', () => {
    const first = getInputKey(options);
    expect(parse).toHaveBeenCalled();
    parse.mockClear();
    expect(getInputKey(options)).toBe(first);
    expect(parse).not.toHaveBeenCalled();
    expect(
      fs.existsSync(
        path.join(
          directory,
          'apps/web-embed/out-dir-bundle/web-embed-input-cache.json',
        ),
      ),
    ).toBe(true);
  });

  it.each([
    'content',
    'new-import',
    'higher-priority-file',
    'package-resolution',
    'corrupt-cache',
    'modified-cache',
    'deleted-cache',
    'unrelated-file',
  ])('preserves fresh-scan behavior after %s', (change) => {
    const before = getInputKey(options);
    const source = path.join(directory, 'feature.js');
    const stat = fs.statSync(source);
    const cachePath = path.join(
      directory,
      'apps/web-embed/out-dir-bundle/web-embed-input-cache.json',
    );
    if (change === 'content') {
      fs.writeFileSync(source, 'export const value = 2;\n');
      fs.utimesSync(source, stat.atime, stat.mtime);
    }
    if (change === 'new-import') {
      fs.writeFileSync(source, "export { value } from './new.js';\n");
      fs.writeFileSync(
        path.join(directory, 'new.js'),
        'export const value = 3;\n',
      );
    }
    if (change === 'higher-priority-file')
      fs.writeFileSync(
        path.join(directory, 'feature.web.js'),
        'export const value = 4;\n',
      );
    if (change === 'package-resolution')
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({ browser: { './feature.js': './replacement.js' } }),
      );
    if (change === 'package-resolution')
      fs.writeFileSync(
        path.join(directory, 'replacement.js'),
        'export const value = 5;\n',
      );
    if (change === 'corrupt-cache') fs.writeFileSync(cachePath, '{');
    if (change === 'modified-cache') {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      cached.payload.inputKey = '0'.repeat(64);
      fs.writeFileSync(cachePath, JSON.stringify(cached));
    }
    if (change === 'deleted-cache') fs.rmSync(cachePath);
    if (change === 'unrelated-file')
      fs.writeFileSync(
        path.join(directory, 'unrelated.js'),
        'export const value = 6;\n',
      );
    parse.mockClear();
    const after = getInputKey(options);
    if (change === 'unrelated-file') {
      expect(after).toBe(before);
      expect(parse).not.toHaveBeenCalled();
    } else {
      expect(parse).toHaveBeenCalled();
    }
    expect(after).toBe(getInputKey({ ...options, inputCache: false }));
    if (
      [
        'content',
        'new-import',
        'higher-priority-file',
        'package-resolution',
      ].includes(change)
    )
      expect(after).not.toBe(before);
  });

  it('does not reuse a snapshot after a dependency is deleted', () => {
    getInputKey(options);
    fs.rmSync(path.join(directory, 'feature.js'));
    expect(() => getInputKey(options)).toThrow('Unable to resolve');
  });

  it('reuses directory imports even though the file lookup misses', () => {
    fs.rmSync(path.join(directory, 'feature.js'));
    fs.mkdirSync(path.join(directory, 'feature'));
    fs.writeFileSync(
      path.join(directory, 'feature/index.js'),
      'export const value = 1;\n',
    );
    const before = getInputKey(options);
    parse.mockClear();
    expect(getInputKey(options)).toBe(before);
    expect(parse).not.toHaveBeenCalled();
  });

  it('detects changed imports in the target of a symlink entry', () => {
    const entry = path.join(directory, 'entry.js');
    const target = path.join(directory, 'target.js');
    fs.renameSync(entry, target);
    fs.symlinkSync('./target.js', entry);
    fs.writeFileSync(
      path.join(directory, 'new.js'),
      'export const value = 2;\n',
    );
    const before = getInputKey(options);
    fs.writeFileSync(target, "import './feature';\nimport './new';\n");
    const after = getInputKey(options);
    expect(after).not.toBe(before);
    expect(after).toBe(getInputKey({ ...options, inputCache: false }));
  });

  it('does not persist a graph when source changes during the scan', () => {
    const originalParse = parse.getMockImplementation();
    const entry = path.join(directory, 'entry.js');
    parse.mockImplementationOnce((...args) => {
      const result = originalParse(...args);
      fs.writeFileSync(entry, "import './feature';\nimport './new';\n");
      fs.writeFileSync(
        path.join(directory, 'new.js'),
        'export const value = 2;\n',
      );
      return result;
    });
    getInputKey(options);
    parse.mockClear();
    const after = getInputKey(options);
    expect(parse).toHaveBeenCalled();
    expect(after).toBe(getInputKey({ ...options, inputCache: false }));
  });

  it('detects a symlink redirected to different source', () => {
    const source = path.join(directory, 'feature.js');
    fs.renameSync(source, path.join(directory, 'first.js'));
    fs.writeFileSync(
      path.join(directory, 'second.js'),
      'export const value = 2;\n',
    );
    fs.symlinkSync('./first.js', source);
    const before = getInputKey(options);
    fs.rmSync(source);
    fs.symlinkSync('./second.js', source);
    expect(getInputKey(options)).not.toBe(before);
    expect(getInputKey(options)).toBe(
      getInputKey({ ...options, inputCache: false }),
    );
  });

  it('invalidates dependency metadata when the locked package resolution changes', () => {
    const dependency = path.join(directory, 'node_modules/example');
    fs.mkdirSync(dependency, { recursive: true });
    fs.writeFileSync(path.join(directory, 'entry.js'), "import 'example';\n");
    fs.writeFileSync(
      path.join(dependency, 'index.js'),
      'export const value = 1;\n',
    );
    fs.writeFileSync(
      path.join(dependency, 'package.json'),
      JSON.stringify({ name: 'example', version: '1.0.0', main: 'index.js' }),
    );
    const lockPath = path.join(directory, 'yarn.lock');
    const lock =
      '"example@npm:1.0.0":\n  version: "1.0.0"\n  resolution: "example@npm:1.0.0"\n  checksum: first\n';
    fs.writeFileSync(lockPath, lock);
    const before = getInputKey(options);
    fs.writeFileSync(
      lockPath,
      lock.replace('checksum: first', 'checksum: second'),
    );
    expect(getInputKey(options)).not.toBe(before);
  });

  it('still scans correctly when the cache directory cannot be created', () => {
    const parent = path.join(directory, 'apps/web-embed');
    fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(path.join(parent, 'out-dir-bundle'), 'not a directory');
    expect(getInputKey(options)).toBe(
      getInputKey({ ...options, inputCache: false }),
    );
  });
});
