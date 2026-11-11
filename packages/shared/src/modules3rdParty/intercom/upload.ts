import { OneKeyLocalError } from '../../errors';
import { streamingFetch } from '../../utils/streamingFetch';

import { appendSupportImage } from './uploadFile';

import type {
  IIntercomBlock,
  IIntercomImage,
  IIntercomMessengerSession,
} from './messengerTypes';

// Intercom's documented upload origins, including regional workspaces.
const uploadOrigins = new Set([
  'https://uploads.intercomcdn.com',
  'https://uploads.intercomcdn.eu',
  'https://uploads.au.intercomcdn.com',
  'https://uploads.eu.intercomcdn.com',
  'https://uploads.intercomusercontent.com',
]);

export async function uploadIntercomImage(
  session: Pick<
    IIntercomMessengerSession,
    'getUploadMetadata' | 'assertCurrent'
  >,
  image: IIntercomImage,
  signal: AbortSignal,
): Promise<IIntercomBlock> {
  if (
    (!image.path.startsWith('file://') && !image.blob) ||
    !image.mime.startsWith('image/') ||
    image.size <= 0 ||
    image.size > 20 * 1024 * 1024
  ) {
    throw new OneKeyLocalError('Support image must be smaller than 20 MB');
  }
  const name = image.filename || image.path.split('/').pop() || 'image';
  const { destination, publicUrl, fields } = await session.getUploadMetadata({
    filename: name,
    mime: image.mime,
    size: image.size,
    width: image.width,
    height: image.height,
  });
  if (!uploadOrigins.has(new URL(destination).origin)) {
    throw new OneKeyLocalError('Invalid support upload destination');
  }
  await session.assertCurrent();
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  appendSupportImage(form, image, name);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 60_000);
  try {
    // The native transport serializes Expo Files and enforces aborts and
    // redirect rejection. Never retry an upload without an explicit action.
    const result = await streamingFetch(destination, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
    });
    await session.assertCurrent();
    if (!result.ok) throw new OneKeyLocalError('Support image upload failed');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
  return {
    type: 'image',
    url: publicUrl,
    width: image.width,
    height: image.height,
  };
}
