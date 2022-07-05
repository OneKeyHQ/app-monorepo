export const SUPPORTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg'];

export const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav'];

export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4'];

export const SUPPORTED_SVG_EXTENSIONS = ['svg'];

export default function isSupportedUriExtension(
  extensions: string[],
  formats?: string[] | null,
): boolean {
  const result = formats?.filter((format) => extensions.includes(format));
  if (result && result.length > 0) {
    return true;
  }
  return false;
}

export const isImage = (format?: string[] | null) =>
  isSupportedUriExtension(SUPPORTED_IMAGE_EXTENSIONS, format);

export const isAudio = (format?: string[] | null) =>
  isSupportedUriExtension(SUPPORTED_AUDIO_EXTENSIONS, format);

export const isVideo = (format?: string[] | null) =>
  isSupportedUriExtension(SUPPORTED_VIDEO_EXTENSIONS, format);

export const isSVG = (format?: string[] | null) =>
  isSupportedUriExtension(SUPPORTED_SVG_EXTENSIONS, format);
