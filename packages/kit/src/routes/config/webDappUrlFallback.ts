type IAllowListRule = {
  showParams: boolean;
  showUrl?: boolean;
};

type IAllowList = Record<string, IAllowListRule>;

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
  const matchedKey = allowListKeys.find((key) => new RegExp(key).test(path));
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
