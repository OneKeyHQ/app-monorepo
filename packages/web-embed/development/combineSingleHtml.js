const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');

const DIST_FOLDER = path.resolve(__dirname, '../web-build/');
const INPUT_FILE = path.join(DIST_FOLDER, 'index.html');
const OUTPUT_FILE = path.join(DIST_FOLDER, 'single-web-embed.html');

const content = fs.readFileSync(INPUT_FILE, { encoding: 'utf8' });
const finalContent = content.replace(
  /<script\s+src="(.*?)"\s*>\s*<\/script>/g,
  (m0, m1, m2, m3, index, str) => {
    const jsContent = fs.readFileSync(path.join(DIST_FOLDER, m1));
    return `
    <script data-js-src="${m1}">
      ${jsContent}
    </script>
    `;
  },
);

fs.writeFileSync(OUTPUT_FILE, finalContent, { encoding: 'utf8' });
