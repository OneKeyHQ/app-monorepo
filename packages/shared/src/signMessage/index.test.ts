import { isPrimaryTypePermitSign } from '.';

import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

function buildTypedDataMessage(primaryType: string) {
  return {
    type: EMessageTypesEth.TYPED_DATA_V4,
    message: `{"primaryType":"${primaryType}"}`,
  };
}

describe('isPrimaryTypePermitSign', () => {
  it.each([
    'Permit',
    'PermitSingle',
    'PermitBatch',
    'PermitTransferFrom',
    'PermitBatchTransferFrom',
    'PermitWitnessTransferFrom',
    'PermitBatchWitnessTransferFrom',
  ])('recognizes %s as a Permit signature', (primaryType) => {
    expect(
      isPrimaryTypePermitSign({
        unsignedMessage: buildTypedDataMessage(primaryType),
      }),
    ).toBe(true);
  });

  it.each(['PermitDetails', 'TokenPermissions', 'PermitUnknown'])(
    'does not classify %s as a Permit signature',
    (primaryType) => {
      expect(
        isPrimaryTypePermitSign({
          unsignedMessage: buildTypedDataMessage(primaryType),
        }),
      ).toBe(false);
    },
  );
});
