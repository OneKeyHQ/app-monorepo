import { shouldRequestTrezorWebUsbPermissionBeforeListing } from './ConnectionFlowTrezorUtils';

describe('ConnectionFlowTrezorUtils', () => {
  it('requests WebUSB permission before listing only in extension UI', () => {
    expect(
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isExtension: true,
      }),
    ).toBe(true);

    expect(
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isExtension: false,
      }),
    ).toBe(false);
  });

});
