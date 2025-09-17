require('../../development/env');

const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const mobileDirPath = __dirname;
const projectRootPath = path.join(mobileDirPath, '../..');
const indexFilePath = path.join(mobileDirPath, 'index.ts');
const bundleOutputPath = path.join(mobileDirPath, 'out-dir-bundle');
const zipOutputPath = path.join(mobileDirPath, 'out-dir-bundle-zip');

const SENTRY_ORG = 'onekey-bb';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_TOKEN;

const webEmbedOutputPath = path.join(
  projectRootPath,
  'apps/web-embed/web-build',
);

const buildZipOutputAssetPath = (zipName) => {
  return path.join(zipOutputPath, zipName);
};

const buildIOSOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'ios', assetName);
};

const buildAndroidOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'android', assetName);
};

const buildAndroidOutputBundlePath = (bundleName) => {
  return path.join(bundleOutputPath, 'android', bundleName);
};

const cleanBundleOutput = async () => {
  fs.rmSync(webEmbedOutputPath, { recursive: true, force: true });
  fs.rmSync(bundleOutputPath, { recursive: true, force: true });
  fs.rmSync(zipOutputPath, { recursive: true, force: true });
};

const ensureBundleOutputPath = async () => {
  if (!fs.existsSync(bundleOutputPath)) {
    fs.mkdirSync(bundleOutputPath, { recursive: true });
  }
};

const ensureZipOutputPath = async () => {
  if (!fs.existsSync(zipOutputPath)) {
    fs.mkdirSync(zipOutputPath, { recursive: true });
  }
};

const ignoreFiles = ['.DS_Store'];

const shouldIgnoreFile = (fileName) => {
  return ignoreFiles.some((pattern) => {
    return fileName.endsWith(pattern);
  });
};

const generateMetadataJson = async (dirPath) => {
  const metadata = {};

  const traverseDirectory = (currentPath) => {
    const items = fs.readdirSync(currentPath);

    items.forEach((item) => {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && !shouldIgnoreFile(item)) {
        try {
          const fileContent = fs.readFileSync(itemPath);
          const hash = crypto
            .createHash('sha256')
            .update(fileContent)
            .digest('hex');

          // Use relative path from the base directory as the key
          const relativePath = path.relative(dirPath, itemPath);
          metadata[relativePath] = hash;
        } catch (error) {
          console.warn(`Failed to hash file ${itemPath}:`, error.message);
        }
      } else if (stat.isDirectory()) {
        traverseDirectory(itemPath);
      }
    });
  };

  if (fs.existsSync(dirPath)) {
    traverseDirectory(dirPath);

    // Write metadata.json
    const metadataPath = path.join(dirPath, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`Generated metadata.json at: ${metadataPath}`);
    console.log(`Total files processed: ${Object.keys(metadata).length}`);
  } else {
    console.warn(`Directory not found: ${dirPath}`);
  }
};

const generateFileInfo = async (filePath, outputFilePath) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const size = fileBuffer.length;

  const fileName = path.basename(filePath);
  const fileDir = path.dirname(filePath);
  const infoFileName = `${fileName}.info`;
  const infoFilePath = outputFilePath || path.join(fileDir, infoFileName);

  const fileInfo = {
    fileName,
    sha256,
    size,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(infoFilePath, JSON.stringify(fileInfo, null, 2));
  console.log(`Generated info file: ${infoFilePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Size: ${size} bytes`);
};

const buildIOSBundle = async () => {
  ensureBundleOutputPath();
  ensureZipOutputPath();
  console.log('build ios bundle');
  execSync(
    `npx react-native bundle \
    --dev false \
    --minify false \
    --platform ios \
    --entry-file ${indexFilePath} \
    --reset-cache \
    --assets-dest ${buildIOSOutputAssetPath('assets')} \
    --bundle-output ${buildIOSOutputAssetPath('main.jsbundle')} \
    --sourcemap-output ${buildIOSOutputAssetPath('main.jsbundle.map')}
    `,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
      },
    },
  );
  console.log('build ios bundle done');

  console.log('build ios bundle hbc');
  execSync(
    `${path.join(
      mobileDirPath,
      'ios/Pods/hermes-engine/destroot/bin/hermesc',
    )} -O -emit-binary -output-source-map -out=${buildIOSOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildIOSOutputAssetPath('main.jsbundle')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle hbc done');

  console.log('build ios bundle packager map');
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.map'),
    buildIOSOutputAssetPath('main.jsbundle.packager.map'),
  );
  console.log('build ios bundle packager map done');

  console.log('build ios bundle compose source maps');
  execSync(
    `node \
  ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} \
  ${buildIOSOutputAssetPath('main.jsbundle.packager.map')} \
  ${buildIOSOutputAssetPath('main.jsbundle.hbc.map')} \
  -o ${buildIOSOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle compose source maps done');

  console.log('build ios bundle compose source maps');
  execSync(
    `node \
  ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} \
  ${buildIOSOutputAssetPath(
    'main.jsbundle.packager.map',
  )} ${buildIOSOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle compose source maps done');

  console.log('build ios bundle remove packager map');
  fs.rmSync(buildIOSOutputAssetPath('main.jsbundle.packager.map'));
  console.log('build ios bundle remove packager map done');

  if (SENTRY_AUTH_TOKEN) {
    console.log('build ios bundle upload source maps');
    execSync(
      `${path.join(
        projectRootPath,
        'node_modules/@sentry/cli/bin/sentry-cli',
      )}  sourcemaps upload \
  --debug-id-reference \
  --strip-prefix ${projectRootPath} \
  ${buildIOSOutputAssetPath('main.jsbundle')} ${buildIOSOutputAssetPath(
        'main.jsbundle.map',
      )}`,
      {
        stdio: 'inherit',
        env: {
          SENTRY_AUTH_TOKEN,
          SENTRY_ORG,
          SENTRY_PROJECT,
        },
      },
    );
    console.log('build ios bundle upload source maps done');
  }
  const distPath = buildIOSOutputAssetPath('dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
  }
  fs.moveSync(
    buildIOSOutputAssetPath('assets'),
    buildIOSOutputAssetPath('dist/assets'),
  );
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.hbc'),
    buildIOSOutputAssetPath('dist/main.jsbundle.hbc'),
  );
  console.log('build ios bundle compress dist to zip');

  const webEmbedIOSPath = path.join(distPath, 'web-embed');
  if (!fs.existsSync(webEmbedIOSPath)) {
    fs.mkdirSync(webEmbedIOSPath, { recursive: true });
  }
  execSync(`rsync -r -c -v ${webEmbedOutputPath}/ ${webEmbedIOSPath}/`, {
    stdio: 'inherit',
  });
  generateMetadataJson(distPath);
  execSync(`cd ${distPath} && zip -r dist.zip .`, {
    stdio: 'inherit',
  });

  const zipFilePath = buildZipOutputAssetPath('ios-bundle.zip');
  fs.moveSync(buildIOSOutputAssetPath('dist/dist.zip'), zipFilePath);
  generateFileInfo(zipFilePath);
  generateFileInfo(
    buildIOSOutputAssetPath('dist/metadata.json'),
    buildZipOutputAssetPath('ios.metadata.json.info'),
  );
  console.log('build ios bundle compress dist to zip done');
  console.log('build ios bundle done');
};

const buildAndroidBundle = async () => {
  ensureBundleOutputPath();
  ensureZipOutputPath();
  execSync(
    `npx react-native bundle \
    --dev false \
    --minify false \
    --platform android \
    --entry-file ${indexFilePath} \
    --reset-cache \
    --assets-dest ${buildAndroidOutputAssetPath('assets')} \
    --bundle-output ${buildAndroidOutputAssetPath('main.jsbundle')} \
    --sourcemap-output ${buildAndroidOutputAssetPath('main.jsbundle.map')}    
    `,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
      },
    },
  );
  console.log('build android bundle done');

  console.log('build android bundle compress to hbc');
  execSync(
    `${path.join(
      projectRootPath,
      'node_modules/react-native/sdks/hermesc/osx-bin/hermesc',
    )} -emit-binary -out ${buildAndroidOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildAndroidOutputAssetPath('main.jsbundle')}`,
    {
      stdio: 'inherit',
    },
  );
  console.log('build android bundle compress to hbc done');

  if (SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT) {
    console.log('build android bundle upload source maps');
    execSync(
      `${path.join(
        projectRootPath,
        'node_modules/@sentry/cli/bin/sentry-cli',
      )}  sourcemaps upload \
  --debug-id-reference \
  --strip-prefix ${projectRootPath} \
  ${buildAndroidOutputAssetPath('main.jsbundle')} ${buildAndroidOutputAssetPath(
        'main.jsbundle.map',
      )}`,
      {
        stdio: 'inherit',
        env: {
          SENTRY_AUTH_TOKEN,
          SENTRY_ORG,
          SENTRY_PROJECT,
        },
      },
    );
    console.log('build android bundle upload source maps done');
  }
  const distPath = buildAndroidOutputAssetPath('dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
  }
  fs.moveSync(
    buildAndroidOutputAssetPath('assets'),
    buildAndroidOutputAssetPath('dist/assets'),
  );
  fs.moveSync(
    buildAndroidOutputAssetPath('main.jsbundle.hbc'),
    buildAndroidOutputAssetPath('dist/main.jsbundle.hbc'),
  );

  const webEmbedAndroidPath = path.join(distPath, 'web-embed');
  if (!fs.existsSync(webEmbedAndroidPath)) {
    fs.mkdirSync(webEmbedAndroidPath, { recursive: true });
  }
  execSync(`rsync -r -c -v ${webEmbedOutputPath}/ ${webEmbedAndroidPath}/`, {
    stdio: 'inherit',
  });

  console.log('build android bundle compress dist to zip');
  generateMetadataJson(distPath);
  execSync(`cd ${distPath} && zip -r dist.zip .`, {
    stdio: 'inherit',
  });

  const zipFilePath = buildZipOutputAssetPath('android-bundle.zip');
  fs.moveSync(buildAndroidOutputAssetPath('dist/dist.zip'), zipFilePath);
  generateFileInfo(zipFilePath);
  generateFileInfo(
    buildAndroidOutputAssetPath('dist/metadata.json'),
    buildZipOutputAssetPath('android.metadata.json.info'),
  );
  console.log('build android bundle compress dist to zip done');
  console.log('build android bundle done');
};

const buildWebEmbed = async () => {
  console.log('build web embed');
  execSync(
    `cd ${path.join(projectRootPath, 'apps/web-embed')} &&  webpack build`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
      },
    },
  );
  console.log('build web embed done');
};

cleanBundleOutput();
buildWebEmbed();
buildIOSBundle();
buildAndroidBundle();
