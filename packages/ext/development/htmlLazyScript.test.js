const path = require('path');

describe('htmlLazyScript Tests', () => {
  it('test processBackgroundHtml', () => {
    const { renameJsFileOfBackgroundHtml } = require('./htmlLazyScript');
    renameJsFileOfBackgroundHtml({
      folder: path.resolve(__dirname, '../build/firefox'),
    });
  });
});
