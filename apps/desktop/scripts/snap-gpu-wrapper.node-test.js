/* eslint-disable no-template-curly-in-string */
/* cspell:ignore LIBGL LIBVA glvnd craftctl */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test: nodeTest } = require('node:test');

const { default: SnapTarget } = require('app-builder-lib/out/targets/snap');
const { Arch } = require('builder-util');

const test = process.platform === 'linux' ? nodeTest : nodeTest.skip;
const wrapper = path.join(__dirname, 'snap-gpu-wrapper.sh');
const probe = [
  process.execPath,
  '-e',
  'console.log(JSON.stringify({ld:process.env.LD_LIBRARY_PATH,egl:process.env.__EGL_VENDOR_LIBRARY_DIRS,gbm:process.env.GBM_BACKENDS_PATH,dri:process.env.LIBGL_DRIVERS_PATH,va:process.env.LIBVA_DRIVERS_PATH,desktopReady:process.env.DESKTOP_SETUP_COMPLETE,args:process.argv.slice(1)}))',
  '--',
  'argument with spaces',
  'onekey-wallet://test?value=a&other=b',
];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap gpu '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'snapctl'),
    '#!/bin/sh\nexit "${TEST_CONNECTION_EXIT:-0}"\n',
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    SNAP: root,
    SNAP_ARCH: 'amd64',
    SNAP_LIBRARY_PATH: '/host-driver',
    LD_LIBRARY_PATH: '/host-driver:/desktop/lib:/staged/lib',
    LIBGL_DRIVERS_PATH: '/desktop/dri',
    LIBVA_DRIVERS_PATH: '/desktop/dri',
    GBM_BACKENDS_PATH: '',
    __EGL_VENDOR_LIBRARY_DIRS: '',
    TEST_CONNECTION_EXIT: '0',
    PATH: `${bin}:${process.env.PATH}`,
  };
  const run = () =>
    spawnSync('/bin/bash', [wrapper, ...probe], { env, encoding: 'utf8' });
  const mesa = (prefix, triplet = 'x86_64-linux-gnu') => {
    const library = path.join(root, 'gpu-2404', prefix, 'usr', 'lib', triplet);
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, 'libgbm.so.1'), 'fixture');
    return library;
  };
  const provider = (body) => {
    const file = path.join(root, 'gpu-2404/bin/gpu-2404-provider-wrapper');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o755 });
  };
  return { root, env, run, mesa, provider };
}

test('provider controls its layout, preserves arguments, and precedes staged libraries', (t) => {
  const f = fixture(t);
  f.mesa('mesa-2404');
  f.env.SNAP_ARCH = 'another-provider-architecture';
  f.provider(
    'export LD_LIBRARY_PATH="${LD_LIBRARY_PATH:+$LD_LIBRARY_PATH:}$SNAP/gpu-2404/vendor/lib:$SNAP/gpu-2404/vendor/dri"\nexport __EGL_VENDOR_LIBRARY_DIRS="$SNAP/gpu-2404/vendor/egl"\nexport LIBVA_DRIVERS_PATH="$SNAP/gpu-2404/vendor/dri"\nexec "$@"',
  );
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(
    value.ld,
    `/host-driver:${f.root}/gpu-2404/vendor/lib:${f.root}/gpu-2404/vendor/dri:/host-driver:/desktop/lib:/staged/lib`,
  );
  assert.equal(value.egl, `${f.root}/gpu-2404/vendor/egl`);
  assert.equal(value.va, `${f.root}/gpu-2404/vendor/dri`);
  assert.equal(value.dri, undefined);
  assert.deepEqual(value.args, probe.slice(-2));
});

for (const [layout, architecture, triplet] of [
  ['', 'amd64', 'x86_64-linux-gnu'],
  ['mesa-2404', 'amd64', 'x86_64-linux-gnu'],
  ['', 'arm64', 'aarch64-linux-gnu'],
  ['mesa-2404', 'arm64', 'aarch64-linux-gnu'],
]) {
  test(`missing wrapper falls back to ${layout || 'legacy'} on ${architecture}`, (t) => {
    const f = fixture(t);
    f.env.SNAP_ARCH = architecture;
    const library = f.mesa(layout, triplet);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout);
    assert.ok(
      value.ld.startsWith(
        `/host-driver:${library}:${library}/dri:${library}/gbm:`,
      ),
    );
    assert.equal(value.dri, `${library}/dri`);
    assert.equal(
      value.egl,
      `${path.dirname(path.dirname(library))}/share/glvnd/egl_vendor.d`,
    );
    assert.deepEqual(value.args, probe.slice(-2));
  });
}

test('fallback chooses one complete root when both layouts exist', (t) => {
  const f = fixture(t);
  f.mesa('');
  const library = f.mesa('mesa-2404');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).dri, `${library}/dri`);
});

test('provider failure is returned without attempting directory fallback', (t) => {
  const f = fixture(t);
  f.mesa('');
  f.provider('echo provider-failed >&2\nexit 73');
  const result = f.run();
  assert.equal(result.status, 73);
  assert.match(result.stderr, /provider-failed/);
});

test('empty inherited library paths do not introduce a current-directory search', (t) => {
  const f = fixture(t);
  f.env.SNAP_LIBRARY_PATH = '';
  f.env.LD_LIBRARY_PATH = '';
  f.provider('export LD_LIBRARY_PATH="$SNAP/gpu-2404/vendor/lib"\nexec "$@"');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ld, `${f.root}/gpu-2404/vendor/lib`);
});

test('disconnected interface and missing libraries fail explicitly', (t) => {
  const f = fixture(t);
  assert.match(f.run().stderr, /No usable GPU provider/);
  f.env.TEST_CONNECTION_EXIT = '1';
  assert.match(f.run().stderr, /interface is not connected/);
});

async function descriptor(executableWrapper) {
  const target = new SnapTarget(
    'snap',
    {
      config: {
        electronVersion: '44.5.1',
        snap: { base: 'core24', useTemplateApp: false, executableWrapper },
      },
      platformSpecificBuildOptions: {},
      executableName: 'onekey-wallet',
      appInfo: { version: '6.8.0', productName: 'OneKey' },
    },
    { getDescription: () => 'OneKey' },
    '/tmp',
  );
  return target.createDescriptor(Arch.x64);
}

test('packaging inserts the wrapper after desktop setup without changing command arguments', async (t) => {
  const f = fixture(t);
  const snap = await descriptor('app/resources/snap-gpu-wrapper.sh');
  assert.equal(snap.apps['onekey-wallet'].command, 'command.sh');
  const install = path.join(f.root, 'install');
  fs.mkdirSync(install);
  const launcher = path.join(install, 'desktop-gnome-specific.sh');
  fs.writeFileSync(
    launcher,
    '#!/bin/bash\nexport DESKTOP_SETUP_COMPLETE=true\nexec "$@"\n',
  );
  const script = snap.parts['launch-scripts']['override-build'];
  const result = spawnSync(
    '/bin/bash',
    ['-c', `craftctl() { test "$1" = default; }\n${script}`],
    {
      env: { ...process.env, CRAFT_PART_INSTALL: install },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(launcher, 'utf8'),
    /exec \/bin\/bash "\$SNAP\/app\/resources\/snap-gpu-wrapper.sh" "\$@"/,
  );
  const packagedWrapper = path.join(
    f.root,
    'app/resources/snap-gpu-wrapper.sh',
  );
  fs.mkdirSync(path.dirname(packagedWrapper), { recursive: true });
  fs.copyFileSync(wrapper, packagedWrapper);
  f.mesa('mesa-2404');
  const launched = spawnSync('/bin/bash', [launcher, ...probe], {
    env: f.env,
    encoding: 'utf8',
  });
  assert.equal(launched.status, 0, launched.stderr);
  assert.equal(JSON.parse(launched.stdout).desktopReady, 'true');
  assert.deepEqual(JSON.parse(launched.stdout).args, probe.slice(-2));
  fs.writeFileSync(launcher, '#!/bin/bash\nexec changed-command "$@"\n');
  const changed = spawnSync(
    '/bin/bash',
    ['-c', `craftctl() { test "$1" = default; }\n${script}`],
    {
      env: { ...process.env, CRAFT_PART_INSTALL: install },
      encoding: 'utf8',
    },
  );
  assert.notEqual(changed.status, 0);
  const original = await descriptor(undefined);
  assert.equal(original.parts['launch-scripts']['override-build'], undefined);
  await assert.rejects(descriptor('../outside.sh'), /relative script path/);
});
