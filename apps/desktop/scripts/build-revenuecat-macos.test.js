const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const plist = require('@expo/plist').default;

const {
  verifyResourceBundles,
  writeResourceBundleMetadata,
} = require('./build-revenuecat-macos');

describe('RevenueCat App Store resource bundle metadata', () => {
  let resources;
  let sdkInfoPath;

  beforeEach(() => {
    resources = fs.mkdtempSync(path.join(os.tmpdir(), 'revenuecat-bundles-'));
    sdkInfoPath = path.join(
      resources,
      'RevenueCat_RevenueCat.bundle/Info.plist',
    );
    fs.mkdirSync(path.dirname(sdkInfoPath), { recursive: true });
    fs.writeFileSync(
      sdkInfoPath,
      plist.build({
        CFBundleDevelopmentRegion: 'en',
        SDKMetadata: 'preserved',
      }),
    );
    for (const relative of [
      'RevenueCat_RevenueCat.bundle/PrivacyInfo.xcprivacy',
      'PurchasesHybridCommon.bundle/Contents/Resources/PrivacyInfo.xcprivacy',
    ]) {
      const file = path.join(resources, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, plist.build({ NSPrivacyTracking: false }));
    }
  });

  afterEach(() => {
    fs.rmSync(resources, { recursive: true, force: true });
  });

  test('completes the minimal SwiftPM plist while retaining SDK metadata and privacy resources', () => {
    const privacyPath = path.join(
      resources,
      'RevenueCat_RevenueCat.bundle/PrivacyInfo.xcprivacy',
    );
    const privacy = fs.readFileSync(privacyPath);
    writeResourceBundleMetadata(resources);

    expect(() => verifyResourceBundles(resources)).not.toThrow();
    expect(plist.parse(fs.readFileSync(sdkInfoPath, 'utf8'))).toMatchObject({
      CFBundleIdentifier: 'com.revenuecat.RevenueCat.resources',
      CFBundlePackageType: 'BNDL',
      CFBundleVersion: '5.80.3',
      SDKMetadata: 'preserved',
    });
    expect(fs.readFileSync(privacyPath)).toEqual(privacy);
  });

  test.each([
    undefined,
    '',
    'com.revenuecat.Invalid_Bundle',
    'com.wrong.bundle',
  ])(
    'rejects a missing, invalid, or unexpected bundle identifier: %s',
    (identifier) => {
      writeResourceBundleMetadata(resources);
      const info = plist.parse(fs.readFileSync(sdkInfoPath, 'utf8'));
      delete info.CFBundleIdentifier;
      if (identifier !== undefined) info.CFBundleIdentifier = identifier;
      fs.writeFileSync(sdkInfoPath, plist.build(info));

      expect(() => verifyResourceBundles(resources)).toThrow(
        'Invalid App Store resource bundle metadata',
      );
    },
  );

  test('rejects a missing Hybrid Common privacy manifest', () => {
    writeResourceBundleMetadata(resources);
    fs.unlinkSync(
      path.join(
        resources,
        'PurchasesHybridCommon.bundle/Contents/Resources/PrivacyInfo.xcprivacy',
      ),
    );
    expect(() => verifyResourceBundles(resources)).toThrow();
  });
});
