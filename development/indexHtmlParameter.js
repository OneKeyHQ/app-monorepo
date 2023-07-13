const fs = require('fs');
const path = require('path');

function createEjsParams({ filename = '', platform = '', browser = '' }) {
  const htmlHeadPreloadCode = fs.readFileSync(
    path.resolve(__dirname, '../packages/ext/src/assets/preload-html-head.js'),
    {
      encoding: 'utf-8',
    },
  );

  return {
    filename,
    platform,
    browser,
    htmlHeadPreloadCode,
    isDev: process.env.NODE_ENV === 'development',
  };
}

function createInterpolateParams({ filename, platform }) {
  return {
    WEB_PUBLIC_URL: '',
    WEB_TITLE: '',
    LANG_ISO_CODE: 'en',
    // These are for legacy ejected web/index.html files
    NO_SCRIPT: `<form action="" style="background-color:#fff;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;"><div style="font-size:18px;font-family:Helvetica,sans-serif;line-height:24px;margin:10%;width:80%;"> <p>Oh no! It looks like JavaScript is not enabled in your browser.</p> <p style="margin:20px 0;"> <button type="submit" style="background-color: #4630EB; border-radius: 100px; border: none; box-shadow: none; color: #fff; cursor: pointer; font-weight: bold; line-height: 20px; padding: 6px 16px;">Reload</button> </p> </div> </form>`,
    ROOT_ID: 'root',
  };
}
module.exports = {
  createEjsParams,
  createInterpolateParams,
};
