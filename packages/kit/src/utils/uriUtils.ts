import querystring from 'querystring';

import parse from 'url-parse';

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.gif',
];

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav'];

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4'];

export const SUPPORTED_SVG_EXTENSIONS = ['.svg'];

export function parseUri(url: string) {
  return parse(url);
}

export function parseQuerystring(qs: string) {
  return querystring.parse(qs);
}

export function parseUrlObject(url: string) {
  return new URL(url);
}

export default function isSupportedUriExtension(
  extensions: string[],
  uri?: string | null,
): boolean {
  if (typeof uri !== 'string' || !Array.isArray(extensions)) {
    return false;
  }
  try {
    const { href, pathname, protocol } = parse(uri || '');
    const supported = extensions.reduce(
      (maybeSupported: boolean, ext: string): boolean =>
        maybeSupported ||
        (typeof ext === 'string' &&
          pathname.toLowerCase().endsWith(ext.toLowerCase())),
      false,
    );
    return href === uri && supported && protocol === 'https:';
  } catch (e) {
    return false;
  }
}

export const isImage = (uri?: string | null) =>
  isSupportedUriExtension(SUPPORTED_IMAGE_EXTENSIONS, uri);

export const isAudio = (uri?: string | null) =>
  isSupportedUriExtension(SUPPORTED_AUDIO_EXTENSIONS, uri);

export const isVideo = (uri?: string | null) =>
  isSupportedUriExtension(SUPPORTED_VIDEO_EXTENSIONS, uri);

export const isSVG = (uri?: string | null) =>
  isSupportedUriExtension(SUPPORTED_SVG_EXTENSIONS, uri);

export function getSvgContent(data: string) {
  if (data.startsWith('data:image/svg+xml;base64,')) {
    const svg = data.replace('data:image/svg+xml;base64,', '');
    const decodedSvg = Buffer.from(svg, 'base64').toString('utf-8');
    return decodedSvg;
  }
  if (data.startsWith('data:image/svg+xml;utf8,')) {
    const svg = data.replace('data:image/svg+xml;utf8,', '');
    return svg;
  }
  return data;
}
