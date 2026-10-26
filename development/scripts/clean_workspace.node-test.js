/* cspell:words LOCALAPPDATA prebundle */
const assert = require('assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const os = require('os');
const path = require('path');

const {
  getMobileShellCacheRoot,
  getSharedCacheRoot,
} = require('../../apps/mobile/scripts/dev-cache-paths');

const { cleanWorkspace } = require('./clean_workspace');

for (const platform of ['darwin', 'linux', 'win32']) {
  test(`cleans mobile artifacts and default/custom shared caches on ${platform}`, () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-clean-test-'),
    );
    const repoRoot = path.join(directory, 'repo');
    const homeDirectory = path.join(directory, 'home');
    const env = {
      LOCALAPPDATA: path.join(directory, 'local-app-data'),
      XDG_CACHE_HOME: path.join(directory, 'xdg-cache'),
      ONEKEY_METRO_PREBUNDLE_CACHE_DIR: path.join(
        directory,
        'custom-vendor-cache',
      ),
    };
    const createFile = (file) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'fixture');
      return file;
    };
    try {
      const artifacts = [
        'node_modules/.cache/onekey-mobile-dev/sessions/run.json',
        'apps/mobile/node_modules/.cache/metro-cache/bundle',
        'apps/mobile/out-dir-bundle/dev-shell/local-cache/ios/shell.zip',
        'apps/mobile/out-dir-bundle/dev-shell/local-cache/signed/digest/ios/shell.zip',
        'apps/mobile/out-dir-bundle/dev-shell/local-cache/ios/receipt.json',
        'apps/mobile/out-dir-bundle/dev-vendor/ios/manifest.json',
        'apps/mobile/out-dir-bundle/dev-session/session.json',
        'apps/mobile/ios/outputs/Build/Products/OneKeyWallet.app/binary',
        'apps/mobile/ios/Pods/Manifest.lock',
        'apps/mobile/ios/OneKeyWallet/web-embed/index.html',
        'apps/web-embed/web-build/index.html',
        'apps/web-embed/out-dir-bundle/web-embed-prebundle-build.json',
        'apps/web-embed/out-dir-bundle/web-embed-prebundle-restored.json',
        'apps/web-embed/out-dir-bundle/web-embed-input-cache.json',
        'apps/web-embed/out-dir-bundle/web-embed-prebundle-release/web-embed.tar.gz',
      ].map((relativePath) => createFile(path.join(repoRoot, relativePath)));
      const sharedRoots = new Set([
        path.join(homeDirectory, '.cache/onekey/mobile-dev-shell'),
        getMobileShellCacheRoot(env, homeDirectory),
        getSharedCacheRoot({}, platform, homeDirectory),
        getSharedCacheRoot(
          { ...env, ONEKEY_METRO_PREBUNDLE_CACHE_DIR: undefined },
          platform,
          homeDirectory,
        ),
        env.ONEKEY_METRO_PREBUNDLE_CACHE_DIR,
      ]);
      for (const root of sharedRoots) {
        for (const version of ['v1', 'v2', 'v3']) {
          artifacts.push(
            createFile(path.join(root, version, 'cached-artifact')),
          );
        }
      }
      const preserved = [
        createFile(path.join(repoRoot, 'apps/mobile/ios/AppDelegate.swift')),
        createFile(path.join(repoRoot, 'apps/mobile/ios/Podfile.lock')),
        createFile(path.join(repoRoot, 'apps/web-embed/index.js')),
        createFile(
          path.join(env.ONEKEY_METRO_PREBUNDLE_CACHE_DIR, 'unrelated/file'),
        ),
        createFile(path.join(env.XDG_CACHE_HOME, 'another-app/cache')),
      ];
      const outside = createFile(path.join(directory, 'outside/keep'));
      fs.symlinkSync(
        path.dirname(outside),
        path.join(env.ONEKEY_METRO_PREBUNDLE_CACHE_DIR, 'v9'),
        'dir',
      );
      preserved.push(outside);
      const commands = [];
      const options = {
        repoRoot,
        env,
        platform,
        homeDirectory,
        run: (command, settings) => commands.push({ command, settings }),
        log: () => {},
      };
      cleanWorkspace(options);
      for (const artifact of artifacts)
        assert.equal(fs.existsSync(artifact), false, artifact);
      for (const file of preserved)
        assert.equal(fs.readFileSync(file, 'utf8'), 'fixture', file);
      assert.equal(commands[0].command, 'yarn cache clean');
      assert.equal(commands[0].settings.cwd, repoRoot);
      cleanWorkspace(options);
      assert.equal(commands.length, 2);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
