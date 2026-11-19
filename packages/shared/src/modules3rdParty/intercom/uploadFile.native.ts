import { File } from 'expo-file-system';

import type { IIntercomImage } from './messengerTypes';

export function appendSupportImage(
  form: FormData,
  image: IIntercomImage,
  name: string,
) {
  // Expo's Fetch requires a Blob-compatible file, not RN's legacy URI part.
  form.append('file', new File(image.path), name);
}
