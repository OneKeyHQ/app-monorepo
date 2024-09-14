const fs = require('fs');
const path = require('path');

function removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        console.log(`Removing directory: ${dirPath}`);
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        console.log(`Removing file: ${filePath}`);
        fs.unlinkSync(filePath);
    }
}

function cleanWorkspace() {
    // Clean yarn cache
    console.log('Cleaning yarn cache...');
    require('child_process').execSync('yarn cache clean', { stdio: 'inherit' });

    // Root folder cleanup
    removeDir('node_modules');
    removeDir('.expo');
    removeDir('.husky/_');
    removeDir('.app-mono-ts-cache');

    // Desktop cleanup
    removeDir('apps/desktop/node_modules');
    removeDir('apps/desktop/.expo');
    removeDir('apps/desktop/__generated__');
    removeDir('apps/desktop/dist');
    removeDir('apps/desktop/build');
    removeDir('apps/desktop/build-electron');
    removeDir('apps/desktop/public/static/js-sdk');
    removeDir('apps/desktop/public/static/connect');
    removeFile('apps/desktop/public/static/preload.js');

    // Ext cleanup
    removeDir('apps/ext/node_modules');
    removeDir('apps/ext/.expo');
    removeDir('apps/ext/build');
    removeFile('apps/ext/src/entry/injected.js');
    removeFile('apps/ext/src/entry/injected.text-js');

    // Mobile cleanup
    removeDir('apps/mobile/node_modules');
    removeDir('apps/mobile/.expo');
    removeDir('apps/mobile/__generated__');
    removeDir('apps/mobile/ios/Pods');
    removeDir('apps/mobile/ios/build');
    removeDir('apps/mobile/ios/OneKeyWallet/web-embed');
    removeDir('apps/mobile/ios/OneKeyWallet.xcworkspace/xcuserdata');
    removeDir('apps/mobile/src/public/static/connect');
    removeDir('apps/mobile/android/.gradle');
    removeDir('apps/mobile/android/build');
    removeDir('apps/mobile/android/app/build');
    removeDir('apps/mobile/android/lib-keys-secret/build');
    removeDir('apps/mobile/android/lib-keys-secret/.cxx');
    removeDir('apps/mobile/android/app/src/main/assets/web-embed');

    // Web cleanup
    removeDir('apps/web/node_modules');
    removeDir('apps/web/.expo');
    removeDir('apps/web/__generated__');
    removeDir('apps/web/dist');
    removeDir('apps/web/web-build');
    removeDir('apps/web/.expo-shared');

    // Web-embed cleanup
    removeDir('apps/web-embed/node_modules');
    removeDir('apps/web-embed/.expo');
    removeDir('apps/web-embed/__generated__');
    removeDir('apps/web-embed/dist');
    removeDir('apps/web-embed/web-build');
    removeDir('apps/web-embed/.expo-shared');

    // Package cleanup
    removeDir('packages/components/node_modules');
    removeDir('packages/core/node_modules');
    removeDir('packages/kit/node_modules');
    removeFile('packages/kit/src/components/WebView/injectedNative.text-js');
    removeDir('packages/kit-bg/node_modules');
    removeDir('packages/shared/node_modules');
    removeFile('packages/shared/src/web/index.html');
}

cleanWorkspace();
console.log("Workspace cleaned.");
