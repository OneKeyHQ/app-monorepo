import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IIntercomImage } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';

export function pickSupportImage(): Promise<IIntercomImage | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.oncancel = () => resolve(undefined);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
        reject(
          new OneKeyLocalError('Support image must be smaller than 20 MB'),
        );
        return;
      }
      const path = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const scale = Math.min(
            1,
            4096 / image.naturalWidth,
            4096 / image.naturalHeight,
          );
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context)
            throw new OneKeyLocalError('Cannot encode support image');
          // Only decoded pixels reach the upload. Preserve PNG transparency;
          // flatten other formats onto white before encoding a fresh JPEG.
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          if (mime === 'image/jpeg') {
            context.fillStyle = '#fff';
            context.fillRect(0, 0, width, height);
          }
          context.drawImage(image, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(path);
              if (!blob || blob.size > 20 * 1024 * 1024) {
                reject(new OneKeyLocalError('Cannot encode support image'));
                return;
              }
              resolve({
                path: URL.createObjectURL(blob),
                mime: blob.type,
                size: blob.size,
                filename: `${file.name.replace(/\.[^.]*$/, '') || 'support-image'}.${blob.type === 'image/png' ? 'png' : 'jpg'}`,
                width,
                height,
                blob,
              });
            },
            mime,
            0.9,
          );
        } catch (error) {
          URL.revokeObjectURL(path);
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(path);
        reject(new OneKeyLocalError('Invalid support image'));
      };
      image.src = path;
    };
    input.click();
  });
}
export async function cleanSupportImage(path: string) {
  URL.revokeObjectURL(path);
}
