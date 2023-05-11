import { JsonRpcProvider } from '@mysten/sui.js';
import { array, boolean, object, string } from 'superstruct';

import type {
  ObjectId,
  SequenceNumber,
  SuiObjectDataOptions,
} from '@mysten/sui.js';
import type { Infer } from 'superstruct';

export type GetPastObjectRequest = {
  objectId: ObjectId;
  version: SequenceNumber;
};

const Fields = object({
  'balance': string(),
  'id': string(),
});

const Content = object({
  'dataType': string(),
  'type': string(),
  'hasPublicTransfer': boolean(),
  'fields': Fields,
});

// json to superstruct
// https://quicktype-superstruct.jguddas.de/
export const SuiPastObjectResponse = object({
  status: string(),
  details: object({
    objectId: string(),
    version: string(),
    digest: string(),
    type: string(),
    owner: object({
      'AddressOwner': string(),
    }),
    content: Content,
  }),
});

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SuiPastObjectResponse = Infer<typeof SuiPastObjectResponse>;

export class OneKeyJsonRpcProvider extends JsonRpcProvider {
  async tryGetPastObject(input: {
    object_id: ObjectId;
    version: number;
    options?: SuiObjectDataOptions;
  }): Promise<SuiPastObjectResponse> {
    return this.client.requestWithType(
      'sui_tryGetPastObject',
      [input.object_id, input.version, input.options],
      SuiPastObjectResponse,
    );
  }

  async tryMultiGetPastObjects(input: {
    past_objects: GetPastObjectRequest[];
    options?: SuiObjectDataOptions;
  }): Promise<SuiPastObjectResponse[]> {
    // input.past_objects.forEach((id) => {
    //   if (!id || !isValidSuiObjectId(normalizeSuiObjectId(id.object_id))) {
    //     throw new Error(`Invalid Sui Object id ${id.object_id}`);
    //   }
    // });
    // const hasDuplicates =
    //   input.past_objects.length !== new Set(input.past_objects).size;
    // if (hasDuplicates) {
    //   throw new Error(
    //     `Duplicate object ids in batch call ${JSON.stringify(
    //       input.past_objects,
    //     )}`,
    //   );
    // }

    return this.client.requestWithType(
      'sui_tryMultiGetPastObjects',
      [input.past_objects, input.options],
      array(SuiPastObjectResponse),
    );
  }
}
