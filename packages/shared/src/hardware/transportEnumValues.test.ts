import {
  HARDWARE_CARDANO_ADDRESS_TYPE,
  HARDWARE_RESOURCE_TYPE,
  HARDWARE_TON_WALLET_VERSION,
} from './transportEnumValues';

describe('hardware transport enum wire values', () => {
  it('keeps values aligned with the hardware message protocol', () => {
    expect(HARDWARE_CARDANO_ADDRESS_TYPE).toEqual({
      BASE: 0,
      BASE_SCRIPT_KEY: 1,
      BASE_KEY_SCRIPT: 2,
      BASE_SCRIPT_SCRIPT: 3,
      POINTER: 4,
      POINTER_SCRIPT: 5,
      ENTERPRISE: 6,
      ENTERPRISE_SCRIPT: 7,
      BYRON: 8,
      REWARD: 14,
      REWARD_SCRIPT: 15,
    });
    expect(HARDWARE_RESOURCE_TYPE).toEqual({ WallPaper: 0, Nft: 1 });
    expect(HARDWARE_TON_WALLET_VERSION).toEqual({ V4R2: 3 });
  });
});
