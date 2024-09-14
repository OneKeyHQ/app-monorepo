const fs = require('fs');
const { execSync } = require('child_process');

function postinstall() {
    // Run yarn setup:env
    console.log('Running yarn setup:env...');
    execSync('yarn setup:env', { stdio: 'inherit' });

    // Run patch-package
    console.log('Running patch-package...');
    execSync('patch-package', { stdio: 'inherit' });

    // Run yarn copy:inject
    console.log('Running yarn copy:inject...');
    execSync('yarn copy:inject', { stdio: 'inherit' });

    // Remove realm-flipper-plugin-device src directory
    const realmDir = 'node_modules/realm-flipper-plugin-device/src';
    if (fs.existsSync(realmDir)) {
        console.log(`Removing directory: ${realmDir}`);
        fs.rmSync(realmDir, { recursive: true, force: true });
    }
}

postinstall();
console.log('Post-installation steps completed.');
