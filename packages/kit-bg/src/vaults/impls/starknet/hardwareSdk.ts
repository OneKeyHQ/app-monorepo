import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const STARK_FIELD_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;
const felt = z
  .string()
  .regex(/^0x[0-9a-fA-F]{1,64}$/)
  .refine(
    (value) =>
      /^0x[0-9a-fA-F]{1,64}$/.test(value) && BigInt(value) < STARK_FIELD_PRIME,
  );
const publicKey = felt.refine((value) => /^0x[0-9a-fA-F]{64}$/.test(value));
const publicKeySchema = z.object({ path: z.string().min(1), pub: publicKey });
const addressSchema = z.object({ path: z.string().min(1), address: felt });
const signedSchema = z.object({
  transactionHash: felt,
  signature: z.string().regex(/^0x[0-9a-fA-F]{128}$/),
});
const responseSchema = z.object({ success: z.boolean(), payload: z.unknown() });
const errorSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  error: z.string(),
  message: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional().catch(undefined),
  connectId: z.string().optional(),
  deviceId: z.string().optional(),
});

type IParams = Record<string, unknown>;
type IBundleParams = IParams & { bundle: IParams[] };
type IResponse<T> =
  | { success: true; payload: T }
  | { success: false; payload: z.infer<typeof errorSchema> };
type IRawMethod = (
  connectId: string,
  deviceId: string,
  params: IParams,
) => Promise<unknown>;
type IRawSdk = {
  starknetGetPublicKey: IRawMethod;
  starknetGetAddress: IRawMethod;
  starknetSignTransaction: IRawMethod;
};

type IRawPrivacySdk = IRawSdk & {
  starknetExportPrivacyViewingKey: IRawMethod;
};

const REQUIRED_METHODS = [
  'starknetGetPublicKey',
  'starknetGetAddress',
  'starknetSignTransaction',
] as const;

function supportsStarknet(sdk: unknown): sdk is IRawSdk {
  if (typeof sdk !== 'object' || sdk === null) return false;
  const methods = sdk as Record<string, unknown>;
  return REQUIRED_METHODS.every((name) => typeof methods[name] === 'function');
}

function parseResponse<T>(value: unknown, schema: z.ZodType<T>): IResponse<T> {
  const response = responseSchema.safeParse(value);
  if (!response.success) {
    throw new OneKeyLocalError('Starknet: malformed hardware response');
  }
  if (!response.data.success) {
    const error = errorSchema.safeParse(response.data.payload);
    if (!error.success) {
      throw new OneKeyLocalError('Starknet: malformed hardware error');
    }
    return { success: false, payload: error.data };
  }
  const payload = schema.safeParse(response.data.payload);
  if (!payload.success) {
    throw new OneKeyLocalError('Starknet: malformed hardware payload');
  }
  return { success: true, payload: payload.data };
}

// Older SDK packages do not expose Starknet. Check before any device call,
// and validate responses independently of the SDK's formatting helpers.
export function getStarknetHardwareSdk(sdk: unknown) {
  if (!supportsStarknet(sdk)) {
    throw new OneKeyLocalError(
      'This app version does not support Starknet hardware accounts. Update the app before continuing.',
    );
  }
  return {
    async starknetGetPublicKey(
      connectId: string,
      deviceId: string,
      params: IBundleParams,
    ) {
      return parseResponse(
        await sdk.starknetGetPublicKey(connectId, deviceId, params),
        z.array(publicKeySchema).length(params.bundle.length),
      );
    },
    async starknetGetAddress(
      connectId: string,
      deviceId: string,
      params: IBundleParams,
    ) {
      return parseResponse(
        await sdk.starknetGetAddress(connectId, deviceId, params),
        z.array(addressSchema).length(params.bundle.length),
      );
    },
    async starknetSignTransaction(
      connectId: string,
      deviceId: string,
      params: IParams,
    ) {
      return parseResponse(
        await sdk.starknetSignTransaction(connectId, deviceId, params),
        signedSchema,
      );
    },
  };
}

export function getStarknetHardwarePrivacySdk(sdk: unknown) {
  if (
    !supportsStarknet(sdk) ||
    typeof (sdk as Partial<IRawPrivacySdk>).starknetExportPrivacyViewingKey !==
      'function'
  ) {
    throw new OneKeyLocalError(
      'This app version does not support Starknet hardware privacy. Update the app before continuing.',
    );
  }
  const privacySdk = sdk as IRawPrivacySdk;
  return {
    ...getStarknetHardwareSdk(sdk),
    async starknetExportPrivacyViewingKey(
      connectId: string,
      deviceId: string,
      params: IParams,
    ) {
      return parseResponse(
        await privacySdk.starknetExportPrivacyViewingKey(
          connectId,
          deviceId,
          params,
        ),
        z.object({ viewingKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
      );
    },
  };
}
