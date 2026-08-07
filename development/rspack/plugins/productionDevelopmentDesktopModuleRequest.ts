export const DEVELOPMENT_DESKTOP_DIRECTORY_PATTERN =
  /[\\/]developmentDesktop[\\/]/u;

const DESKTOP_MODULE_SUFFIX_PATTERN = /\.desktop(?:\.[cm]?[jt]sx?)?$/u;
const MODULE_EXTENSION_PATTERN = /\.[cm]?[jt]sx?$/u;

export function resolveProductionDevelopmentDesktopModuleRequest(
  request: string,
): string {
  if (!DEVELOPMENT_DESKTOP_DIRECTORY_PATTERN.test(request)) {
    return request;
  }
  const suffixIndex = request.search(/[?#]/u);
  const resource = suffixIndex === -1 ? request : request.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : request.slice(suffixIndex);
  let baseResource = `${resource}.ts`;
  if (DESKTOP_MODULE_SUFFIX_PATTERN.test(resource)) {
    baseResource = resource.replace(DESKTOP_MODULE_SUFFIX_PATTERN, '.ts');
  } else if (MODULE_EXTENSION_PATTERN.test(resource)) {
    baseResource = resource.replace(MODULE_EXTENSION_PATTERN, '.ts');
  }
  return `${baseResource}${suffix}`;
}
