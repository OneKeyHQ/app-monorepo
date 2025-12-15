import { cloneDeep, isEqual } from 'lodash';

import { ECloudBackupProviderType } from '../cloudBackup/cloudBackupTypes';
import stringUtils from '../utils/stringUtils';

import keylessWalletUtils from './keylessWalletUtils';

import type {
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
  IKeylessWalletUserInfo,
} from './keylessWalletTypes';

/*
yarn test packages/shared/src/keylessWallet/keylessWalletUtils.test.ts
*/

// Mock user info for testing
const mockUserInfo: IKeylessWalletUserInfo = {
  onekeyIdEmail: 'test@onekey.so',
  onekeyIdUserId: 'user-123456',
  cloudKeyProvider: ECloudBackupProviderType.iCloud,
  cloudKeyUserId: 'cloud-user-789',
  cloudKeyUserEmail: 'cloud-user@icloud.com',
};

// Helper function to find all different paths between two objects
function findDiffPaths(obj1: unknown, obj2: unknown, path = ''): string[] {
  const diffs: string[] = [];

  if (obj1 === obj2) return diffs;

  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    diffs.push(`${path}: ${JSON.stringify(obj1)} !== ${JSON.stringify(obj2)}`);
    return diffs;
  }

  const record1 = obj1 as Record<string, unknown>;
  const record2 = obj2 as Record<string, unknown>;
  const keys1 = Object.keys(record1);
  const keys2 = Object.keys(record2);
  const allKeys = new Set([...keys1, ...keys2]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const val1 = record1[key];
    const val2 = record2[key];
    diffs.push(...findDiffPaths(val1, val2, newPath));
  }

  return diffs;
}

// Helper function to compare packs with stable fields only
function isPacksEqual(
  packs1: IKeylessWalletPacks,
  packs2: IKeylessWalletPacks,
): boolean {
  const normalize = (packs: IKeylessWalletPacks) => {
    const cloned = cloneDeep(packs);
    cloned.authKeyPack.encrypted = 'encrypted';
    cloned.cloudKeyPack.encrypted = 'encrypted';
    cloned.deviceKeyPack.encrypted = 'encrypted';
    return cloned;
  };
  return isEqual(normalize(packs1), normalize(packs2));
}

// Helper function to print diff paths for debugging
function printPacksDiff(
  packs1: IKeylessWalletPacks,
  packs2: IKeylessWalletPacks,
): void {
  const normalize = (packs: IKeylessWalletPacks) => {
    const cloned = cloneDeep(packs);
    cloned.authKeyPack.encrypted = 'encrypted';
    cloned.cloudKeyPack.encrypted = 'encrypted';
    cloned.deviceKeyPack.encrypted = 'encrypted';
    return cloned;
  };
  const diffs = findDiffPaths(normalize(packs1), normalize(packs2));
  if (diffs.length > 0) {
    console.log('Packs differences:');
    diffs.forEach((diff) => console.log(`  - ${diff}`));
  }
}

// Helper function to extract IKeylessWalletPacks from either type
function getPacks(
  packs: IKeylessWalletPacks | IKeylessWalletRestoredData,
): IKeylessWalletPacks {
  return 'packs' in packs ? packs.packs : packs;
}

describe('keylessWalletUtils', () => {
  describe('generateKeylessMnemonic and restoreMnemonicFromShareKey', () => {
    it('should generate mnemonic with 3 share keys', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();

      // Verify mnemonic is generated (24 words for 256-bit entropy)
      expect(mnemonicInfo.mnemonic).toBeDefined();
      expect(mnemonicInfo.mnemonic.split(' ').length).toBe(24);

      // Verify 3 share keys are generated
      expect(mnemonicInfo.deviceKey).toBeDefined();
      expect(mnemonicInfo.cloudKey).toBeDefined();
      expect(mnemonicInfo.authKey).toBeDefined();

      // Verify X coordinates are extracted
      expect(mnemonicInfo.deviceKeyX).toBeDefined();
      expect(mnemonicInfo.cloudKeyX).toBeDefined();
      expect(mnemonicInfo.authKeyX).toBeDefined();

      // Verify password slices are generated
      expect(mnemonicInfo.deviceKeyPwdSlice).toBeDefined();
      expect(mnemonicInfo.cloudKeyPwdSlice).toBeDefined();
      expect(mnemonicInfo.authKeyPwdSlice).toBeDefined();
    });

    it('should restore mnemonic from deviceKey + cloudKey', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalMnemonic = mnemonicInfo.mnemonic;

      const result = await keylessWalletUtils.restoreMnemonicFromShareKey({
        deviceKey: mnemonicInfo.deviceKey,
        cloudKey: mnemonicInfo.cloudKey,
      });

      expect(result.mnemonic).toBe(originalMnemonic);
      expect(result.shares.length).toBe(2);
    });

    it('should restore mnemonic from deviceKey + authKey', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalMnemonic = mnemonicInfo.mnemonic;

      const result = await keylessWalletUtils.restoreMnemonicFromShareKey({
        deviceKey: mnemonicInfo.deviceKey,
        authKey: mnemonicInfo.authKey,
      });

      expect(result.mnemonic).toBe(originalMnemonic);
      expect(result.shares.length).toBe(2);
    });

    it('should restore mnemonic from cloudKey + authKey', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalMnemonic = mnemonicInfo.mnemonic;

      const result = await keylessWalletUtils.restoreMnemonicFromShareKey({
        cloudKey: mnemonicInfo.cloudKey,
        authKey: mnemonicInfo.authKey,
      });

      expect(result.mnemonic).toBe(originalMnemonic);
      expect(result.shares.length).toBe(2);
    });

    it('should restore mnemonic from all 3 keys', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalMnemonic = mnemonicInfo.mnemonic;

      const result = await keylessWalletUtils.restoreMnemonicFromShareKey({
        deviceKey: mnemonicInfo.deviceKey,
        cloudKey: mnemonicInfo.cloudKey,
        authKey: mnemonicInfo.authKey,
      });

      expect(result.mnemonic).toBe(originalMnemonic);
      expect(result.shares.length).toBe(3);
    });

    it('should throw error when only 1 key is provided', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();

      await expect(
        keylessWalletUtils.restoreMnemonicFromShareKey({
          deviceKey: mnemonicInfo.deviceKey,
        }),
      ).rejects.toThrow('Keyless wallet shares are not enough');

      await expect(
        keylessWalletUtils.restoreMnemonicFromShareKey({
          cloudKey: mnemonicInfo.cloudKey,
        }),
      ).rejects.toThrow('Keyless wallet shares are not enough');

      await expect(
        keylessWalletUtils.restoreMnemonicFromShareKey({
          authKey: mnemonicInfo.authKey,
        }),
      ).rejects.toThrow('Keyless wallet shares are not enough');
    });

    it('should throw error when no keys are provided', async () => {
      await expect(
        keylessWalletUtils.restoreMnemonicFromShareKey({}),
      ).rejects.toThrow('Keyless wallet shares are not enough');
    });

    it('should work with multiple independent mnemonic generations', async () => {
      // Generate two different mnemonics
      const mnemonicInfo1 = await keylessWalletUtils.generateKeylessMnemonic();
      const mnemonicInfo2 = await keylessWalletUtils.generateKeylessMnemonic();

      // Verify they are different
      expect(mnemonicInfo1.mnemonic).not.toBe(mnemonicInfo2.mnemonic);
      expect(mnemonicInfo1.deviceKey).not.toBe(mnemonicInfo2.deviceKey);

      // Restore each independently
      const result1 = await keylessWalletUtils.restoreMnemonicFromShareKey({
        deviceKey: mnemonicInfo1.deviceKey,
        cloudKey: mnemonicInfo1.cloudKey,
      });
      const result2 = await keylessWalletUtils.restoreMnemonicFromShareKey({
        deviceKey: mnemonicInfo2.deviceKey,
        authKey: mnemonicInfo2.authKey,
      });

      expect(result1.mnemonic).toBe(mnemonicInfo1.mnemonic);
      expect(result2.mnemonic).toBe(mnemonicInfo2.mnemonic);
    });
  });

  describe('generateKeylessWalletPacks and restoreFromDeviceAndAuth', () => {
    it('should generate keyless wallet packs with all required fields', async () => {
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const packs = await keylessWalletUtils.generateKeylessWalletPacks({
        userInfo: mockUserInfo,
        mnemonicInfo,
        packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
      });

      // Verify mnemonic info is preserved
      expect(packs.mnemonic).toBe(mnemonicInfo.mnemonic);
      expect(packs.deviceKey).toBe(mnemonicInfo.deviceKey);
      expect(packs.cloudKey).toBe(mnemonicInfo.cloudKey);
      expect(packs.authKey).toBe(mnemonicInfo.authKey);

      // Verify packs are generated
      expect(packs.deviceKeyPack).toBeDefined();
      expect(packs.authKeyPack).toBeDefined();
      expect(packs.cloudKeyPack).toBeDefined();

      // Verify encrypted fields exist
      expect(packs.deviceKeyPack.encrypted).toBeDefined();
      expect(packs.authKeyPack.encrypted).toBeDefined();
      expect(packs.cloudKeyPack.encrypted).toBeDefined();
    });

    it('should restore mnemonic correctly from devicePack + authPack', async () => {
      // Step 1: Generate original packs
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalPacks = await keylessWalletUtils.generateKeylessWalletPacks(
        {
          userInfo: mockUserInfo,
          mnemonicInfo,
          packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
        },
      );

      // Step 2: Restore from devicePack + authPack
      const restoredPacks = await keylessWalletUtils.restoreFromDeviceAndAuth({
        deviceKeyPack: originalPacks.deviceKeyPack,
        authKeyPack: originalPacks.authKeyPack,
      });

      // Step 3: Verify mnemonic is restored correctly
      expect(restoredPacks.packs.mnemonic).toBe(originalPacks.mnemonic);

      // Step 4: Verify user info fields are preserved in packs
      expect(restoredPacks.packs.deviceKeyPack.cloudKeyProvider).toBe(
        mockUserInfo.cloudKeyProvider,
      );

      // Step 5: Verify comparable fields are equal (excluding encrypted and re-generated keys)
      if (!isPacksEqual(originalPacks, restoredPacks.packs)) {
        printPacksDiff(originalPacks, restoredPacks.packs);
      }
      expect(isPacksEqual(originalPacks, restoredPacks.packs)).toBe(true);
    });

    it('should restore from restoredPacks cloudPack + devicePack consistently', async () => {
      // Step 1: Generate original packs
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalPacks = await keylessWalletUtils.generateKeylessWalletPacks(
        {
          userInfo: mockUserInfo,
          mnemonicInfo,
          packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
        },
      );

      // Step 2: Restore from devicePack + authPack to get restored packs with new cloudPack
      const restoredFromDeviceAndAuth =
        await keylessWalletUtils.restoreFromDeviceAndAuth({
          deviceKeyPack: originalPacks.deviceKeyPack,
          authKeyPack: originalPacks.authKeyPack,
        });

      // Step 3: Use restored cloudPack + devicePack to restore again
      const restoredFromDeviceAndCloud =
        await keylessWalletUtils.restoreFromDeviceAndCloud({
          deviceKeyPack: originalPacks.deviceKeyPack,
          cloudKeyPack: restoredFromDeviceAndAuth.packs.cloudKeyPack,
        });

      // Step 4: Verify mnemonic is the same
      expect(restoredFromDeviceAndCloud.packs.mnemonic).toBe(
        originalPacks.mnemonic,
      );

      // Step 5: Compare comparable fields between the two restored packs
      expect(
        isPacksEqual(
          restoredFromDeviceAndAuth.packs,
          restoredFromDeviceAndCloud.packs,
        ),
      ).toBe(true);
    });

    it('should restore from restoredPacks cloudPack + authPack consistently', async () => {
      // Step 1: Generate original packs
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalPacks = await keylessWalletUtils.generateKeylessWalletPacks(
        {
          userInfo: mockUserInfo,
          mnemonicInfo,
          packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
        },
      );

      // Step 2: Restore from devicePack + authPack to get restored packs with new cloudPack
      const restoredFromDeviceAndAuth =
        await keylessWalletUtils.restoreFromDeviceAndAuth({
          deviceKeyPack: originalPacks.deviceKeyPack,
          authKeyPack: originalPacks.authKeyPack,
        });

      // Step 3: Use restored cloudPack + authPack to restore again
      const restoredFromAuthAndCloud =
        await keylessWalletUtils.restoreFromAuthAndCloud({
          authKeyPack: originalPacks.authKeyPack,
          cloudKeyPack: restoredFromDeviceAndAuth.packs.cloudKeyPack,
        });

      // Step 4: Verify mnemonic is the same
      expect(restoredFromAuthAndCloud.packs.mnemonic).toBe(
        originalPacks.mnemonic,
      );

      // Step 5: Compare comparable fields between the two restored packs
      expect(
        isPacksEqual(
          restoredFromDeviceAndAuth.packs,
          restoredFromAuthAndCloud.packs,
        ),
      ).toBe(true);
    });

    it('should have consistent restores with all pack combinations', async () => {
      // Step 1: Generate original packs
      const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();
      const originalPacks = await keylessWalletUtils.generateKeylessWalletPacks(
        {
          userInfo: mockUserInfo,
          mnemonicInfo,
          packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
        },
      );

      // Step 2: First wave of restores from originalPacks
      const restoredFromDeviceAndAuth =
        await keylessWalletUtils.restoreFromDeviceAndAuth({
          deviceKeyPack: originalPacks.deviceKeyPack,
          authKeyPack: originalPacks.authKeyPack,
        });

      const restoredFromDeviceAndCloud =
        await keylessWalletUtils.restoreFromDeviceAndCloud({
          deviceKeyPack: originalPacks.deviceKeyPack,
          cloudKeyPack: originalPacks.cloudKeyPack,
        });

      const restoredFromAuthAndCloud =
        await keylessWalletUtils.restoreFromAuthAndCloud({
          authKeyPack: originalPacks.authKeyPack,
          cloudKeyPack: originalPacks.cloudKeyPack,
        });

      // Step 3: Collect all pack sources
      const allPackSources = [
        { name: 'original', packs: originalPacks },
        { name: 'fromDeviceAndAuth', packs: restoredFromDeviceAndAuth },
        { name: 'fromDeviceAndCloud', packs: restoredFromDeviceAndCloud },
        { name: 'fromAuthAndCloud', packs: restoredFromAuthAndCloud },
      ];

      // Step 4: All packs should have the same mnemonic and be equal
      for (const source of allPackSources) {
        const packs = getPacks(source.packs);
        expect(packs.mnemonic).toBe(originalPacks.mnemonic);
      }
      for (let i = 0; i < allPackSources.length; i += 1) {
        for (let j = i + 1; j < allPackSources.length; j += 1) {
          const packsI = getPacks(allPackSources[i].packs);
          const packsJ = getPacks(allPackSources[j].packs);
          expect(isPacksEqual(packsI, packsJ)).toBe(true);
        }
      }

      // Step 5: Test all combinations for restoreFromDeviceAndAuth (4x4=16 combinations)
      for (const deviceSource of allPackSources) {
        for (const authSource of allPackSources) {
          const devicePacks = getPacks(deviceSource.packs);
          const authPacks = getPacks(authSource.packs);
          const restored = await keylessWalletUtils.restoreFromDeviceAndAuth({
            deviceKeyPack: devicePacks.deviceKeyPack,
            authKeyPack: authPacks.authKeyPack,
          });
          expect(restored.packs.mnemonic).toBe(originalPacks.mnemonic);
          expect(isPacksEqual(restored.packs, originalPacks)).toBe(true);
        }
      }

      // Step 6: Test all combinations for restoreFromDeviceAndCloud (4x4=16 combinations)
      for (const deviceSource of allPackSources) {
        for (const cloudSource of allPackSources) {
          const devicePacks = getPacks(deviceSource.packs);
          const cloudPacks = getPacks(cloudSource.packs);
          const restored = await keylessWalletUtils.restoreFromDeviceAndCloud({
            deviceKeyPack: devicePacks.deviceKeyPack,
            cloudKeyPack: cloudPacks.cloudKeyPack,
          });
          expect(restored.packs.mnemonic).toBe(originalPacks.mnemonic);
          expect(isPacksEqual(restored.packs, originalPacks)).toBe(true);
        }
      }

      // Step 7: Test all combinations for restoreFromAuthAndCloud (4x4=16 combinations)
      for (const authSource of allPackSources) {
        for (const cloudSource of allPackSources) {
          const authPacks = getPacks(authSource.packs);
          const cloudPacks = getPacks(cloudSource.packs);
          const restored = await keylessWalletUtils.restoreFromAuthAndCloud({
            authKeyPack: authPacks.authKeyPack,
            cloudKeyPack: cloudPacks.cloudKeyPack,
          });
          expect(restored.packs.mnemonic).toBe(originalPacks.mnemonic);
          expect(isPacksEqual(restored.packs, originalPacks)).toBe(true);
        }
      }
    });
  });
});
