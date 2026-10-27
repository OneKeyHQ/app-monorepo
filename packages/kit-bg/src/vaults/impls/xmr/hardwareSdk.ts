import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const addressSchema = z.object({
  path: z.string().min(1),
  address: z.string().min(1),
});
const watchKeySchema = addressSchema.extend({
  watchKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
});
const keyImageSyncSchema = z.object({
  encKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  keyImages: z.array(
    z.object({
      iv: z.string().regex(/^[0-9a-fA-F]{24}$/),
      blob: z.string().regex(/^(?:[0-9a-fA-F]{2})+$/),
    }),
  ),
});
const responseSchema = z.object({ success: z.boolean(), payload: z.unknown() });
const errorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string(),
  message: z.string().optional(),
  // Matches hd-core Unsuccessful.payload.params; non-object params are dropped.
  params: z.record(z.string(), z.unknown()).optional().catch(undefined),
  connectId: z.string().optional(),
  deviceId: z.string().optional(),
});

export type IXmrHardwareAddress = z.infer<typeof addressSchema>;
export type IXmrHardwareWatchKey = z.infer<typeof watchKeySchema>;
export type IXmrHardwareKeyImageSync = z.infer<typeof keyImageSyncSchema>;
type IResponse<T> =
  | { success: true; payload: T }
  | { success: false; payload: z.infer<typeof errorSchema> };
type IParams = Record<string, unknown>;
type IRawSdk = {
  moneroGetAddress: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
  moneroGetWatchKey: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
  // Newer SDKs only; accounts still work without it, spend detection does not.
  moneroKeyImageSync?: (
    connectId: string,
    deviceId: string,
    params: IParams,
  ) => Promise<unknown>;
};

function supportsMonero(sdk: unknown): sdk is IRawSdk {
  return (
    typeof sdk === 'object' &&
    sdk !== null &&
    'moneroGetAddress' in sdk &&
    typeof sdk.moneroGetAddress === 'function' &&
    'moneroGetWatchKey' in sdk &&
    typeof sdk.moneroGetWatchKey === 'function'
  );
}

function parseResponse<T>(
  value: unknown,
  parsePayload: (payload: unknown) => T,
): IResponse<T> {
  const result = responseSchema.safeParse(value);
  if (!result.success)
    throw new OneKeyLocalError('xmr: malformed hardware response');
  if (!result.data.success) {
    const error = errorSchema.safeParse(result.data.payload);
    if (!error.success)
      throw new OneKeyLocalError('xmr: malformed hardware error');
    return { success: false, payload: error.data };
  }
  return { success: true, payload: parsePayload(result.data.payload) };
}

// SDKs without these methods must fail before any device operation; every
// response is validated here.
export function getXmrHardwareSdk(sdk: unknown) {
  if (!supportsMonero(sdk)) {
    throw new OneKeyLocalError(
      'This app version does not support Monero hardware accounts. Update the app before continuing.',
    );
  }
  const supportedSdk = sdk;
  return {
    async moneroGetAddress(
      connectId: string,
      deviceId: string,
      params: IParams & { bundle: IParams[] },
    ): Promise<IResponse<IXmrHardwareAddress[]>> {
      const result = await supportedSdk.moneroGetAddress(
        connectId,
        deviceId,
        params,
      );
      return parseResponse(result, (value) => {
        const items = z.array(addressSchema).safeParse(value);
        if (!items.success || items.data.length !== params.bundle.length)
          throw new OneKeyLocalError('xmr: malformed hardware address bundle');
        return items.data;
      });
    },
    async moneroGetWatchKey(
      connectId: string,
      deviceId: string,
      params: IParams,
    ): Promise<IResponse<IXmrHardwareWatchKey>> {
      const result = await supportedSdk.moneroGetWatchKey(
        connectId,
        deviceId,
        params,
      );
      return parseResponse(result, (value) => {
        const item = watchKeySchema.safeParse(value);
        if (!item.success)
          throw new OneKeyLocalError('xmr: malformed hardware watch key');
        return item.data;
      });
    },
    async moneroKeyImageSync(
      connectId: string,
      deviceId: string,
      params: IParams & { transfers: IParams[] },
    ): Promise<IResponse<IXmrHardwareKeyImageSync>> {
      if (typeof supportedSdk.moneroKeyImageSync !== 'function') {
        throw new OneKeyLocalError(
          'This app version cannot check Monero hardware spends. Update the app before continuing.',
        );
      }
      const result = await supportedSdk.moneroKeyImageSync(
        connectId,
        deviceId,
        params,
      );
      return parseResponse(result, (value) => {
        const item = keyImageSyncSchema.safeParse(value);
        if (
          !item.success ||
          item.data.keyImages.length !== params.transfers.length
        )
          throw new OneKeyLocalError('xmr: malformed hardware key image sync');
        return item.data;
      });
    },
  };
}
