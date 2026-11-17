import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { ICloudSyncUploadPostData } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

// Conservative client budgets, not a statement of server limits.
export const CLOUD_SYNC_UPLOAD_MAX_ITEMS = 50;
export const CLOUD_SYNC_UPLOAD_MAX_BYTES = 256 * 1024;

export function splitCloudSyncUploadPostData({
  postData,
  maxItems = CLOUD_SYNC_UPLOAD_MAX_ITEMS,
  maxBytes = CLOUD_SYNC_UPLOAD_MAX_BYTES,
}: {
  postData: ICloudSyncUploadPostData;
  maxItems?: number;
  maxBytes?: number;
}): ICloudSyncUploadPostData[] {
  if (
    !Number.isSafeInteger(maxItems) ||
    maxItems < 1 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  ) {
    throw new OneKeyLocalError('Invalid Cloud upload batch budget');
  }

  const envelopeBytes = Buffer.byteLength(
    stringUtils.stableStringify({ ...postData, localData: [] }),
    'utf8',
  );
  if (envelopeBytes > maxBytes) {
    throw new OneKeyLocalError('Cloud upload envelope exceeds client budget');
  }

  const batches: ICloudSyncUploadPostData[] = [];
  let localData: ICloudSyncUploadPostData['localData'] = [];
  let batchBytes = envelopeBytes;
  for (const item of postData.localData) {
    const itemBytes = Buffer.byteLength(
      stringUtils.stableStringify(item),
      'utf8',
    );
    if (envelopeBytes + itemBytes > maxBytes) {
      // Validate the complete input before the caller sends any batch.
      throw new OneKeyLocalError('Cloud upload item exceeds client budget');
    }
    const separatorBytes = localData.length ? 1 : 0;
    if (
      localData.length >= maxItems ||
      batchBytes + separatorBytes + itemBytes > maxBytes
    ) {
      batches.push({ ...postData, localData });
      localData = [];
      batchBytes = envelopeBytes;
    }
    batchBytes += (localData.length ? 1 : 0) + itemBytes;
    localData.push(item);
  }
  if (localData.length) {
    batches.push({ ...postData, localData });
  }
  return batches;
}
