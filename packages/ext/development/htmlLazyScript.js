const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function doTaskInFolder({ folder }) {
  if (!fs.existsSync(folder)) {
    return;
  }
  const files = fs.readdirSync(folder);

  const htmls = files.filter(
    (file) => file.endsWith('.html') && file.startsWith('ui-popup.html'),
  );

  htmls.forEach((htmlFileName) => {
    // const htmlFileName = htmls[3];
    const htmlFile = path.resolve(folder, htmlFileName);
    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    const lazyJsFileName = `${htmlFileName}.lazy.js`;
    const $ = cheerio.load(htmlContent);
    const srcList = [];
    const $body = $('body');
    const isLazyCheckAttr = 'data-is-lazy-script-done';

    if ($body.attr(isLazyCheckAttr)) {
      return;
    }

    $('body script').each((idx, ele) => {
      const $ele = $(ele);
      const src = $ele.attr('src');
      srcList.push(src);
      $ele.remove();
    });
    $body.append(
      $(`

<script src="/${lazyJsFileName}?${Date.now()}" data-is-lazy-script="true"></script>

`),
    );
    $body.attr(isLazyCheckAttr, 'true');
    // console.log($.html());
    fs.writeFileSync(htmlFile, $.html(), {
      encoding: 'utf-8',
    });

    const lazyInitCode = `
(function(){

  const scriptsList = ${JSON.stringify(srcList, null, 2)};

  function createScript(src){
    const s = document.createElement('script');
    s.src=src;
    // s.dataset['isLazyScript']='true';
    document.body.appendChild(s);
  }

  setTimeout(()=>{
    scriptsList.forEach(createScript)
  }, 100);

})();

`;
    const lazyJsFile = path.resolve(folder, lazyJsFileName);
    fs.writeFileSync(lazyJsFile, lazyInitCode, {
      encoding: 'utf-8',
    });
    console.log(lazyJsFile);
  });

  // TODO body data-filename replacement
  fse.copySync(
    path.resolve(folder, 'ui-popup.html'),
    path.resolve(folder, 'ui-standalone-window.html'),
    { overwrite: true },
  );
  fse.copySync(
    path.resolve(folder, 'ui-popup.html'),
    path.resolve(folder, 'ui-expand-tab.html'),
    { overwrite: true },
  );
}

function doTask() {
  doTaskInFolder({
    folder: path.resolve(__dirname, '../build/chrome'),
  });
  doTaskInFolder({
    folder: path.resolve(__dirname, '../build/firefox'),
  });
}
module.exports = doTask;
