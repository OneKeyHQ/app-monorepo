const path = require('path');
const fs = require('fs');

const BASEDIR = path.dirname(__filename);
const webBuildPath = path.resolve(
  BASEDIR,
  '../../../packages/web-embed/web-build',
);

if (process.env.EAS_BUILD || !fs.existsSync(webBuildPath)) {
  require('child_process').execSync('yarn app:web-embed:build', {
    stdio: 'inherit',
  });
}
