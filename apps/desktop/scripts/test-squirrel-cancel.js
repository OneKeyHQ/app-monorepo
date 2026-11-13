// cspell:ignore canceltest
// Requires a local signing identity. Uses unique bundle IDs and external-disk
// fixture directories; never loads, quits, or updates the user's OneKey app.
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const electron = require('electron');
const { build } = require('esbuild');

const { buildSquirrelCancel, output } = require('./build-squirrel-cancel');

const root = path.resolve(__dirname, '../../..');
const destination = process.argv[2];
const identity = process.env.ONEKEY_CANCEL_SIGN_IDENTITY;
assert(
  destination && path.isAbsolute(destination),
  'Pass an absolute, new fixture directory',
);
assert(
  identity,
  'Set ONEKEY_CANCEL_SIGN_IDENTITY to a local code-signing identity',
);
assert(!fs.existsSync(destination), 'Fixture directory must not exist');
fs.mkdirSync(destination, { recursive: true });
const template = path.resolve(electron, '../../..');

const errorStub = `
export const EUpdateErrorCode = new Proxy({}, {get:(_,k)=>({installFailed:'INSTALL_FAILED',cancelled:'CANCELLED',unknown:'UNKNOWN',packageMissing:'PACKAGE_MISSING'})[k]||String(k)});
export function createUpdateError(dto){return Object.assign(new Error('ONEKEY_UPDATE_ERROR:'+JSON.stringify(dto)),{data:{updateError:dto}})}
export function getUpdateError(e,step){return {...(e?.data?.updateError||{code:'UNKNOWN'}),step}}
`;
const stubs = {
  '@onekeyhq/desktop/app/config': 'export const ipcMessageKeys={};',
  '@onekeyhq/desktop/app/constant/gpg': 'export const PUBLIC_KEY="";',
  '@onekeyhq/desktop/app/i18n':
    'export const ElectronTranslations={}; export const i18nText=k=>k;',
  '@onekeyhq/desktop/app/libs/desktopPlatformInfo':
    'export const getDesktopPlatformInfo=()=>({channel:"macosARM",arch:process.arch});',
  '@onekeyhq/desktop/app/libs/store':
    'let n=""; export const clearASCFile=()=>{}; export const setASCFile=()=>{}; export const getASCFile=()=>""; export const getUpdateBuildNumber=()=>n; export const setUpdateBuildNumber=v=>{n=v}; export const clearUpdateBuildNumber=()=>{n=""}; export const getDevSettingsEnabled=()=>false; export const clearUpdateSettings=()=>{}; export const getUpdateSettings=()=>({}); export const setUpdateSettings=()=>{};',
  '@onekeyhq/desktop/app/windowProgressBar':
    'export const clearWindowProgressBar=()=>{}; export const updateWindowProgressBar=()=>{};',
  '@onekeyhq/shared/src/config/appConfig':
    'export const buildServiceEndpoint=()=>"";',
  '@onekeyhq/shared/src/modules3rdParty/auto-update/error': errorStub,
  '@onekeyhq/shared/src/request/customUA':
    'export const withCustomUAHeaders=async(u,h)=>h;',
  '@onekeyhq/shared/types/endpoint': 'export const EServiceEndpointEnum={};',
  'electron-log/main':
    'export default {warn:console.error,info:console.log,error:console.error};',
};

async function prepareBundle() {
  const bundle = path.join(destination, 'fixture.js');
  await build({
    entryPoints: [
      path.join(root, 'apps/desktop/native-modules/squirrel-cancel/fixture.ts'),
    ],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    external: ['electron'],
    plugins: [
      {
        name: 'fixture-ui-and-transport',
        setup(b) {
          b.onResolve({ filter: /^@onekeyhq\// }, ({ path: p }) => {
            if (stubs[p]) return { path: p, namespace: 'fixture' };
            return {
              path: `${p.startsWith('@onekeyhq/desktop/') ? path.join(root, 'apps/desktop', p.slice('@onekeyhq/desktop/'.length)) : path.join(root, p.replace('@onekeyhq/', 'packages/'))}.ts`,
            };
          });
          b.onResolve({ filter: /^electron-log\/main$/ }, ({ path: p }) => ({
            path: p,
            namespace: 'fixture',
          }));
          b.onResolve(
            { filter: /^\.\/(nodeDownload|electronUpdateRequest)$/ },
            ({ path: p }) => ({ path: p, namespace: 'fixture' }),
          );
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: p }) => ({
            contents:
              stubs[p] ||
              (p === './nodeDownload'
                ? 'export const classifyNodeError=e=>e; export const downloadNodeFile=()=>{throw Error("No transport")}; export const stripSensitiveHeaders=h=>h;'
                : 'export const requestUpdateUrl=()=>{throw Error("No transport")};'),
            loader: 'js',
          }));
        },
      },
    ],
  });
  return bundle;
}

function copyApp(directory, version, id, bundle) {
  execFileSync('/usr/bin/ditto', [template, directory]);
  const plist = path.join(directory, 'Contents/Info.plist');
  for (const [key, value] of Object.entries({
    CFBundleIdentifier: id,
    CFBundleName: 'OneKey Cancel Fixture',
    CFBundleExecutable: 'OneKeyCancelFixture',
    CFBundleShortVersionString: version,
    CFBundleVersion: version,
  })) {
    execFileSync('/usr/libexec/PlistBuddy', [
      '-c',
      `Set :${key} ${value}`,
      plist,
    ]);
  }
  fs.renameSync(
    path.join(directory, 'Contents/MacOS/Electron'),
    path.join(directory, 'Contents/MacOS/OneKeyCancelFixture'),
  );
  const resources = path.join(directory, 'Contents/Resources');
  fs.mkdirSync(path.join(resources, 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(resources, 'app/package.json'),
    JSON.stringify({ name: 'onekey-cancel-fixture', version, main: 'main.js' }),
  );
  fs.copyFileSync(bundle, path.join(resources, 'app/main.js'));
  fs.mkdirSync(path.join(resources, 'bin'), { recursive: true });
  fs.copyFileSync(output, path.join(resources, 'bin/squirrel-cancel'));
  fs.chmodSync(path.join(resources, 'bin/squirrel-cancel'), 0o755);
  execFileSync(
    '/usr/bin/codesign',
    ['--force', '--deep', '--sign', identity, directory],
    { stdio: 'pipe' },
  );
  execFileSync(
    '/usr/bin/codesign',
    ['--verify', '--deep', '--strict', directory],
    { stdio: 'pipe' },
  );
}

async function runApp(app, directory, scenario) {
  const log = fs.openSync(path.join(directory, `${scenario}.log`), 'a');
  const child = spawn(
    path.join(app, 'Contents/MacOS/OneKeyCancelFixture'),
    [],
    {
      env: {
        ...process.env,
        ONEKEY_CANCEL_FIXTURE: directory,
        ONEKEY_CANCEL_SCENARIO: scenario,
        ONEKEY_ALLOW_SKIP_GPG_VERIFICATION: 'true',
      },
      stdio: ['ignore', log, log],
    },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Fixture timed out: ${scenario}`));
    }, 90_000);
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      fs.closeSync(log);
      if (code === 0) resolve();
      else reject(new Error(`Fixture exited ${code}: ${directory}`));
    });
  });
}

async function main() {
  buildSquirrelCancel();
  const bundle = await prepareBundle();
  const selected = process.argv.slice(3);
  for (const scenario of selected.length
    ? selected
    : [
        'cancel',
        'restage',
        'control',
        'refusal',
        'retry',
        'quitduring',
        'ownerlost',
        'ownerbeforelost',
        'queuedquit',
      ]) {
    const directory = path.join(destination, scenario);
    fs.mkdirSync(directory);
    const id = `so.onekey.canceltest.t${Date.now()}.${scenario}`;
    const app = path.join(
        '/Applications',
        `OneKeyCancelFixture-${Date.now()}.app`,
      ),
      target = path.join(directory, 'B/Fixture.app');
    fs.mkdirSync(path.dirname(target));
    fs.writeFileSync(
      path.join(directory, 'fixture-paths.json'),
      JSON.stringify({ app, bundleId: id }),
    );
    copyApp(app, '1.0.0', id, bundle);
    copyApp(target, '1.0.1', id, bundle);
    execFileSync('/usr/bin/ditto', [
      '-c',
      '-k',
      '--sequesterRsrc',
      '--keepParent',
      target,
      path.join(directory, 'B.zip'),
    ]);
    await runApp(app, directory, scenario);
    const expected = [
      'cancel',
      'retry',
      'quitduring',
      'ownerlost',
      'ownerbeforelost',
      'queuedquit',
    ].includes(scenario)
      ? '1.0.0'
      : '1.0.1';
    const deadline = Date.now() + 45_000;
    let version;
    do {
      version = execFileSync(
        '/usr/libexec/PlistBuddy',
        [
          '-c',
          'Print :CFBundleShortVersionString',
          path.join(app, 'Contents/Info.plist'),
        ],
        { encoding: 'utf8' },
      ).trim();
      if (version === expected) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    assert.equal(version, expected, `${scenario}: installed version`);
    await runApp(app, directory, 'version');
    const events = fs
      .readFileSync(path.join(directory, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert(
      !events.some((e) => e.event === 'error'),
      `${scenario}: fixture error`,
    );
    assert.equal(
      events.at(-1).version,
      expected,
      `${scenario}: cold-start version`,
    );
    console.log(
      JSON.stringify({
        scenario,
        bundleId: id,
        installedVersion: version,
        coldStartVersion: events.at(-1).version,
        passed: true,
      }),
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
