const fs = require('node:fs');
const path = require('node:path');

const createReviewUi = require('./review/browser-ui');
const { reviewModel } = require('./workflow-review');

function renderReviewHtml(plan, options) {
  const assets = path.join(__dirname, 'review');
  const data = JSON.stringify(reviewModel(plan, options))
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
  const replacements = {
    STYLES: fs.readFileSync(path.join(assets, 'style.css'), 'utf8'),
    DATA: data,
    SCRIPT: `(() => {\nconst reviewUi = (${createReviewUi.toString()})();\n${fs.readFileSync(path.join(assets, 'browser.js'), 'utf8')}\n})();`,
  };
  return fs
    .readFileSync(path.join(assets, 'index.html'), 'utf8')
    .replace(
      /\/\* REVIEW_(STYLES|DATA|SCRIPT) \*\//g,
      (_match, name) => replacements[name],
    );
}

function saveReviewHtml(plan, file, options) {
  if (fs.existsSync(file))
    throw new Error('HTML preview already exists; choose a new output path.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderReviewHtml(plan, options));
  return { html: path.resolve(file), approval: plan.approval };
}

module.exports = { renderReviewHtml, saveReviewHtml };
