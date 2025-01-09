// **** not working in mv3, use exclude_matches in manifest.json instead
//      app-monorepo/apps/ext/src/content-script/excludeMatches.js
export function shouldInject() {
  const { hostname } = globalThis.location;
  // zhihu search will fail if inject custom code
  // const blackList = ['www.zhihu.com', 'zhihu.com']
  const blackList = [] as string[];
  if (blackList.includes(hostname)) {
    return false;
  }
  return true;
}
