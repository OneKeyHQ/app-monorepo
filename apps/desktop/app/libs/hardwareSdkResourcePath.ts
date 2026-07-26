import path from 'path';

const HARDWARE_SDK_URL_MARKER = '/static/js-sdk/';

export const isHardwareSdkResourceRequest = (requestUrl: string): boolean =>
  requestUrl.includes(HARDWARE_SDK_URL_MARKER);

export const getHardwareSdkResourceRelativePath = (
  requestUrl: string,
): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return undefined;
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return undefined;
  }
  const markerIndex = decodedPath.indexOf(HARDWARE_SDK_URL_MARKER);
  if (markerIndex < 0) return undefined;
  const relativePath = decodedPath.slice(
    markerIndex + HARDWARE_SDK_URL_MARKER.length,
  );
  const components = relativePath.split('/');
  if (
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    relativePath.includes('\u0000') ||
    components.some(
      (component) =>
        component.length === 0 || component === '.' || component === '..',
    )
  ) {
    return undefined;
  }
  return components.join('/');
};

export const resolveHardwareSdkResourcePath = ({
  requestUrl,
  rootDir,
}: {
  requestUrl: string;
  rootDir: string;
}): string | undefined => {
  const relativePath = getHardwareSdkResourceRelativePath(requestUrl);
  if (!relativePath) return undefined;
  const normalizedRoot = path.resolve(rootDir);
  const resolved = path.resolve(normalizedRoot, ...relativePath.split('/'));
  if (
    resolved !== normalizedRoot &&
    !resolved.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return undefined;
  }
  return resolved;
};
