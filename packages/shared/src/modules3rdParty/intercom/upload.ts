import { OneKeyLocalError } from '../../errors';
import { streamingFetch } from '../../utils/streamingFetch';

import { intercomHttpUrl, intercomRecord } from './messengerModels';
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
  session: IIntercomMessengerSession,
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
  const response = intercomRecord(
    await session.request('uploads', {
      upload: {
        original_filename: name,
        content_type: image.mime,
        size_in_bytes: image.size,
        width: image.width,
        height: image.height,
      },
      include_metadata: true,
    }),
  );
  const destination = intercomHttpUrl(response.upload_destination);
  const publicUrl = intercomHttpUrl(response.public_url);
  if (
    !destination ||
    !uploadOrigins.has(new URL(destination).origin) ||
    !publicUrl ||
    typeof response.policy !== 'string'
  ) {
    throw new OneKeyLocalError('Invalid support upload destination');
  }
  await session.assertCurrent();
  const form = new FormData();
  for (const [key, value] of Object.entries({
    key: response.key,
    acl: response.acl,
    'Content-Type': response.content_type,
    AWSAccessKeyId: response.aws_access_key,
    policy: response.policy,
    signature: response.signature,
    success_action_status: response.success_action_status,
    'x-amz-meta-safe_app_id': intercomRecord(response.metadata).safe_app_id,
  })) {
    if (typeof value === 'string' || typeof value === 'number')
      form.append(key, String(value));
  }
  appendSupportImage(form, image, name);
  // The native transport serializes Expo Files and enforces redirect rejection.
  const result = await streamingFetch(destination, {
    method: 'POST',
    body: form,
    signal,
    credentials: 'omit',
    redirect: 'error',
  });
  await session.assertCurrent();
  if (!result.ok) throw new OneKeyLocalError('Support image upload failed');
  return {
    type: 'image',
    url: publicUrl,
    width: image.width,
    height: image.height,
  };
}
