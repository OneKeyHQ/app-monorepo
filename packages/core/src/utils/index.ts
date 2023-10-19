import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';

/**
 * m/44'/60'/x'/0/0 -> m/44'/60' for prefix, {index}/0/0 for suffix
 * @param template derivation path template
 * @returns string
 */
export function slicePathTemplate(template: string) {
  const [prefix, suffix] = template.split(INDEX_PLACEHOLDER);
  return {
    pathPrefix: prefix.slice(0, -1),
    pathSuffix: `{index}${suffix}`,
  };
}

export function getUtxoAccountPrefixPath({ fullPath }: { fullPath: string }) {
  const pathComponent = fullPath.split('/');
  pathComponent.pop();
  pathComponent.pop();
  const prefixPath = pathComponent.join('/');
  return prefixPath;
}
