import {
  EThirdPartyHardwareUiAction,
  isThirdPartyToastAction,
} from './hardware';

describe('third-party hardware UI state', () => {
  it('treats passive progress actions as third-party toast actions', () => {
    expect(
      isThirdPartyToastAction(EThirdPartyHardwareUiAction.connecting),
    ).toBe(true);
    expect(
      isThirdPartyToastAction(EThirdPartyHardwareUiAction.processing),
    ).toBe(true);
    expect(isThirdPartyToastAction(EThirdPartyHardwareUiAction.done)).toBe(
      true,
    );
  });
});
