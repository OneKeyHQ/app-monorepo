const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        console.log(`Copying ${src} to ${dest}`);
        fs.copyFileSync(src, dest);
    } else {
        console.log(`Source file ${src} does not exist.`);
    }
}

function copyInjected() {
    // Copy to Desktop preload.js
    copyFile('node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedDesktop.js',
        'apps/desktop/public/static/preload.js');

    // Copy to Extension injected.js
    copyFile('node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedExtension.js',
        'apps/ext/src/entry/injected.js');
    copyFile('apps/ext/src/entry/injected.js', 'apps/ext/src/entry/injected.text-js');

    // Copy to Native injectedCode
    copyFile('node_modules/@onekeyfe/cross-inpage-provider-injected/dist/injected/injectedNative.js',
        'packages/kit/src/components/WebView/injectedNative.text-js');

    // Copy index html
    copyFile('packages/shared/src/web/index.html.ejs', 'packages/shared/src/web/index.html');

    // Create directory for js-sdk if it doesn't exist
    const jsSdkDir = 'apps/desktop/public/static/js-sdk/';
    if (!fs.existsSync(jsSdkDir)) {
        console.log(`Creating directory: ${jsSdkDir}`);
        fs.mkdirSync(jsSdkDir, { recursive: true });
    }

    // Copy hardware js-sdk iframe files to desktop
    const srcJsSdk = 'node_modules/@onekeyfe/hd-web-sdk/build/';
    const destJsSdk = 'apps/desktop/public/static/js-sdk/';
    if (fs.existsSync(srcJsSdk)) {
        console.log(`Copying contents of ${srcJsSdk} to ${destJsSdk}`);
        execSync(`cp -r ${srcJsSdk}* ${destJsSdk}`, { stdio: 'inherit' });
    } else {
        console.log(`Source directory ${srcJsSdk} does not exist.`);
    }

    // Build and copy web-embed
    const baseDir = path.dirname(__filename);
    console.log(`Running web-embed.js in ${baseDir}`);
    execSync(`node ${path.join(baseDir, 'web-embed.js')}`, { stdio: 'inherit' });
}

copyInjected();
console.log("Injected files copied.");
