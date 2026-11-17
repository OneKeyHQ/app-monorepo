import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

export function downloadLogDigest(digest: ILogDigest) {
  if (digest.bundle.type !== 'blob') {
    throw new OneKeyLocalError('Cannot download file-based log bundle');
  }
  const element = document.createElement('a');
  const url = URL.createObjectURL(digest.bundle.blob);
  element.href = url;
  element.download = digest.bundle.fileName;
  document.body.appendChild(element);
  try {
    element.click();
  } finally {
    element.remove();
    URL.revokeObjectURL(url);
  }
}
