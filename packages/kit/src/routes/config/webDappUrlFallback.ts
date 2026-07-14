type IAllowListRule = {
  showParams: boolean;
  showUrl?: boolean;
};

type IAllowList = Record<string, IAllowListRule>;

const DYNAMIC_PATH_SUFFIX = '/.';

function matchesDynamicAllowListPath({
  allowListKey,
  path,
}: {
  allowListKey: string;
  path: string;
}) {
  if (!allowListKey.endsWith(DYNAMIC_PATH_SUFFIX)) {
    return false;
  }
  // buildAllowList collapses one or more route params into a trailing `/.`.
  const pathPrefix = allowListKey.slice(0, -DYNAMIC_PATH_SUFFIX.length);
  const dynamicPath = path.slice(pathPrefix.length + 1);
  return (
    path.startsWith(`${pathPrefix}/`) &&
    dynamicPath.length > 0 &&
    dynamicPath.split('/').every(Boolean)
  );
}

function getAllowListRule({
  allowList,
  allowListKeys,
  path,
}: {
  allowList: IAllowList;
  allowListKeys: string[];
  path: string;
}) {
  const directRule = allowList[path];
  if (directRule) {
    return directRule;
  }
  const matchedKey = allowListKeys.find((key) =>
    matchesDynamicAllowListPath({ allowListKey: key, path }),
  );
  return matchedKey ? allowList[matchedKey] : undefined;
}

export function getWebDappUrlFallback({
  allowList,
  allowListKeys,
  currentPath,
  currentSearch = '',
}: {
  allowList: IAllowList;
  allowListKeys: string[];
  currentPath?: string;
  currentSearch?: string;
}) {
  if (!currentPath) {
    return '/market';
  }
  const pathWithQuery = `${currentPath}${currentSearch}`;
  const rule = getAllowListRule({
    allowList,
    allowListKeys,
    path: currentPath,
  });
  if (!rule?.showUrl) {
    return '/market';
  }
  return rule.showParams ? pathWithQuery : currentPath;
}
