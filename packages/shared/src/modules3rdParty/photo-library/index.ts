import { OneKeyLocalError } from '../../errors';

import type { IPhotoSavePermission, IPickedPhoto } from './type';

function pickImage(): Promise<IPickedPhoto> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    let settled = false;
    let reading = false;
    const handleFocus = () => {
      // Older browsers do not emit the file input's cancel event.
      setTimeout(() => {
        if (!input.files?.length && !reading) {
          input.dispatchEvent(new Event('cancel'));
        }
      }, 300);
    };
    const cleanup = () => {
      globalThis.removeEventListener('focus', handleFocus);
      input.remove();
    };
    const cancel = () => {
      if (settled || reading) return;
      settled = true;
      cleanup();
      resolve({ canceled: true });
    };
    input.addEventListener('cancel', cancel);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        cancel();
        return;
      }
      reading = true;
      cleanup();
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        settled = true;
        if (typeof reader.result === 'string') {
          resolve({ canceled: false, uri: reader.result });
        } else {
          reject(new OneKeyLocalError('Cannot read selected image'));
        }
      });
      reader.addEventListener('error', () => {
        settled = true;
        reject(new OneKeyLocalError('Cannot read selected image'));
      });
      reader.readAsDataURL(file);
    });
    globalThis.addEventListener('focus', handleFocus);
    document.body.appendChild(input);
    try {
      input.click();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

const photoLibrary = {
  pickImage,
  releasePickedImage: async (_uri: string): Promise<void> => {},
  getSavePermission: async (): Promise<IPhotoSavePermission> => {
    throw new OneKeyLocalError(
      'Photo saving is only available on native platforms',
    );
  },
  requestSavePermission: async (): Promise<IPhotoSavePermission> => {
    throw new OneKeyLocalError(
      'Photo saving is only available on native platforms',
    );
  },
  saveToLibrary: async (_uri: string): Promise<void> => {
    throw new OneKeyLocalError(
      'Photo saving is only available on native platforms',
    );
  },
};

export default photoLibrary;
