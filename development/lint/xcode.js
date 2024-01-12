const { exit } = require('process');
const fs = require('fs');

const projectContent = fs.readFileSync(
  'apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj',
  'utf-8',
);

if (projectContent.includes('-Wl -ld_classic')) {
  console.log(
    'Check xcodeproj failed, please remove `-Wl -ld_classic` from project.pbxproj',
  );
  exit(1);
}
