// cspell:ignore reactnativecommunity
const { spawnSync } = require('child_process');
const fs = require('fs');
const { createRequire } = require('module');
const os = require('os');
const path = require('path');

const babel = require('@babel/core');

const devVendorConfig = require('../../dev-vendor.config');
const {
  applyMobileLockdownConfig,
  getMobileLockdownWebEmbedCandidateEnabled,
} = require('../../plugins/mobileLockdown');

const repoRoot = path.resolve(__dirname, '../../../..');
const sourceRoot = path.join(
  repoRoot,
  'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview',
);

function candidateEnvironment() {
  return {
    NODE_ENV: 'production',
    VERSION: '99.0.0',
    BUILD_NUMBER: '1',
    BUNDLE_VERSION: '1',
    ONEKEY_MOBILE_LOCKDOWN_E2E: 'a'.repeat(32),
    ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_ARTIFACT: '/fixture/artifact',
    ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST: '/fixture/manifest.json',
    ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256: 'b'.repeat(64),
  };
}

function withEnvironment(environment, callback) {
  const saved = process.env;
  process.env = { ...environment };
  try {
    return callback();
  } finally {
    process.env = saved;
  }
}

describe('protected APK WebEmbed opt-in', () => {
  test('requires the verified candidate inputs and a Release identity', () => {
    expect(getMobileLockdownWebEmbedCandidateEnabled({})).toBe(false);
    expect(
      getMobileLockdownWebEmbedCandidateEnabled({
        ONEKEY_MOBILE_LOCKDOWN_E2E: 'a'.repeat(32),
        ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER: 'true',
      }),
    ).toBe(false);
    expect(
      getMobileLockdownWebEmbedCandidateEnabled(candidateEnvironment()),
    ).toBe(true);
    for (const [key, value] of [
      ['NODE_ENV', 'development'],
      ['ONEKEY_MOBILE_LOCKDOWN', 'false'],
      ['ONEKEY_MOBILE_LOCKDOWN_E2E', undefined],
      ['VERSION', undefined],
      ['ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_ARTIFACT', undefined],
      ['ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST', ''],
      ['ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256', 'invalid'],
    ]) {
      expect(() =>
        getMobileLockdownWebEmbedCandidateEnabled({
          ...candidateEnvironment(),
          [key]: value,
        }),
      ).toThrow();
    }
  });

  test('injects only a Boolean and separates Metro/vendor caches', () => {
    for (const environment of [{}, candidateEnvironment()]) {
      const config = withEnvironment(environment, () =>
        require('../../babel.config')({ cache() {} }),
      );
      const define = config.plugins.find(
        (plugin) => plugin[2] === 'mobile-lockdown-mode',
      )[1];
      const enabled = getMobileLockdownWebEmbedCandidateEnabled(environment);
      expect(define['process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER']).toBe(
        enabled,
      );
      expect(JSON.stringify(define)).not.toContain('/fixture/');
      const result = babel.transformSync(
        'const enabled = process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;',
        {
          babelrc: false,
          configFile: false,
          plugins: [['transform-define', define]],
        },
      ).code;
      expect(result).toBe(`const enabled = ${enabled};`);
    }
    const keys = [
      candidateEnvironment(),
      {
        ...candidateEnvironment(),
        ONEKEY_MOBILE_LOCKDOWN_E2E_WEB_EMBED_MANIFEST_SHA256: 'c'.repeat(64),
      },
      {},
    ].map((environment) =>
      withEnvironment(
        environment,
        () =>
          applyMobileLockdownConfig({ serializer: { getPolyfills: () => [] } })
            .cacheVersion,
      ),
    );
    expect(new Set(keys).size).toBe(3);
    expect(() =>
      devVendorConfig.applyTransformationEnvironment(candidateEnvironment()),
    ).toThrow(/Release bundles/);
    const vendor = {};
    devVendorConfig.applyTransformationEnvironment(vendor);
    expect(
      devVendorConfig.getTransformationEnvironment(vendor)
        .ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER,
    ).toBe('false');
  });

  test('executes the installed native URL and bridge policy on the JVM', () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-webembed-native-policy-'),
    );
    try {
      const fixture = path.join(temporary, 'WebEmbedUrlPolicyFixture.java');
      fs.writeFileSync(
        fixture,
        `
import com.reactnativecommunity.webview.OneKeyWebEmbedUrlPolicy;
public class WebEmbedUrlPolicyFixture {
  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }
  public static void main(String[] args) {
    String origin = OneKeyWebEmbedUrlPolicy.ORIGIN;
    check(OneKeyWebEmbedUrlPolicy.isDocumentUrl(origin + "/web-embed/index.html#/webembed/api?test=1"), "hash route");
    check("web-embed/static/js/1.abcd.chunk.js".equals(OneKeyWebEmbedUrlPolicy.getAssetPath(origin + "/web-embed/static/js/1.abcd.chunk.js")), "nested asset");
    String[] denied = { "/web-embed/../index.android.bundle", "/web-embed/%2e%2e/index.android.bundle", "/web-embed/%252e%252e/x", "/web-embed/x%2fy", "/web-embed/x%5cy", "/web-embed/%", "/web-embed//x", "/web-embed/./x", "/web-embed/index.html?x", "/web-embed/index.html/", "/other/index.html", "/web-embed/" };
    for (String suffix : denied) {
      check(OneKeyWebEmbedUrlPolicy.getAssetPath(origin + suffix) == null, "asset reject " + suffix);
      check(OneKeyWebEmbedUrlPolicy.isReservedHost(origin + suffix), "no network fallback " + suffix);
    }
    String[] authorities = { "http://appassets.androidplatform.net", "https://appassets.androidplatform.net:443", "https://appassets.androidplatform.net.", "https://user@appassets.androidplatform.net", "https://%61ppassets.androidplatform.net" };
    for (String authority : authorities) {
      check(OneKeyWebEmbedUrlPolicy.getAssetPath(authority + "/web-embed/index.html") == null, "exact authority " + authority);
      check(OneKeyWebEmbedUrlPolicy.isReservedHost(authority + "/web-embed/index.html"), "reserved authority fallback " + authority);
    }
    check(!OneKeyWebEmbedUrlPolicy.isDocumentUrl("https://example.test/web-embed/index.html"), "remote document");
    check(!OneKeyWebEmbedUrlPolicy.isDocumentUrl("file:///android_asset/web-embed/index.html"), "file document");
    check(OneKeyWebEmbedUrlPolicy.isLocalFile("file:///private/secret"), "private file");
    check(OneKeyWebEmbedUrlPolicy.isLocalFile("file:///android_asset/%"), "malformed file fallback");
    check(OneKeyWebEmbedUrlPolicy.isLocalFile("content://provider/secret"), "content provider");
    check(OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed(origin, true), "main frame");
    check(!OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed(origin, false), "same-origin child frame");
    check(!OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed("https://example.test", true), "remote bridge");
    check(!OneKeyWebEmbedUrlPolicy.isBridgeMessageAllowed(origin + "/", true), "legacy URL bridge");
    System.out.println("WEB_EMBED_NATIVE_URL_POLICY_PASS");
  }
}
`,
      );
      const javaTool = (name) =>
        process.env.JAVA_HOME
          ? path.join(process.env.JAVA_HOME, 'bin', name)
          : name;
      const compile = spawnSync(
        javaTool('javac'),
        [
          '--release',
          '11',
          '-d',
          temporary,
          path.join(sourceRoot, 'OneKeyWebEmbedUrlPolicy.java'),
          fixture,
        ],
        { encoding: 'utf8', timeout: 30_000 },
      );
      expect({
        status: compile.status,
        output: `${compile.stdout}${compile.stderr}`,
        error: compile.error?.message,
      }).toEqual({ status: 0, output: '', error: undefined });
      const execute = spawnSync(
        javaTool('java'),
        ['-cp', temporary, 'WebEmbedUrlPolicyFixture'],
        { encoding: 'utf8', timeout: 10_000 },
      );
      expect(execute.status).toBe(0);
      expect(execute.stderr).toBe('');
      expect(execute.stdout.trim()).toBe('WEB_EMBED_NATIVE_URL_POLICY_PASS');
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  test('the real Fabric code generator preserves the default-false scoped prop', () => {
    const reactNativeRequire = createRequire(
      require.resolve('react-native/package.json'),
    );
    const { combineSchemas } = reactNativeRequire(
      '@react-native/codegen/lib/cli/combine/combine-js-to-schema',
    );
    const generator = reactNativeRequire(
      '@react-native/codegen/lib/generators/RNCodegen',
    );
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-webembed-codegen-'),
    );
    try {
      const schema = combineSchemas([
        path.join(
          repoRoot,
          'node_modules/react-native-webview/src/RNCWebViewNativeComponent.ts',
        ),
      ]);
      expect(
        generator.generate(
          {
            schema,
            libraryName: 'RNCWebViewSpec',
            outputDirectory: temporary,
            packageName: 'com.reactnativecommunity.webview',
          },
          { generators: ['componentsAndroid'] },
        ),
      ).toBe(true);
      const generated = path.join(
        temporary,
        'java/com/facebook/react/viewmanagers',
      );
      expect(
        fs.readFileSync(
          path.join(generated, 'RNCWebViewManagerInterface.java'),
          'utf8',
        ),
      ).toContain('void setOneKeyWebEmbedAssets(T view, boolean value);');
      expect(
        fs.readFileSync(
          path.join(generated, 'RNCWebViewManagerDelegate.java'),
          'utf8',
        ),
      ).toContain(
        'mViewManager.setOneKeyWebEmbedAssets(view, value == null ? false : (boolean) value);',
      );
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
