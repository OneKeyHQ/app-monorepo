import { OneKeyLocalError } from '../../errors';

import type { IIntercomImage } from './messengerTypes';

export function appendSupportImage(
  form: FormData,
  image: IIntercomImage,
  name: string,
) {
  if (!image.blob) throw new OneKeyLocalError('Support image is unavailable');
  form.append('file', image.blob, name);
}
