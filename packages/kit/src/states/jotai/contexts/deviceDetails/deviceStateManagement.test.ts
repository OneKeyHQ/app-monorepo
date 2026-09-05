import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import { emptyMetaState } from './atoms';
import {
  buildDeviceMetaStateFromState,
  getDeviceManagementWallets,
  getDeviceMetaStaticDataFromState,
  getDeviceSecondaryIdentifier,
  getDeviceStateSnapshotFromEvent,
  isDeviceManagementWalletUsable,
  mergeDeviceSettingState,
  pickNewerDeviceStateSnapshot,
  resolveDeviceState,
  resolveDeviceWithCurrentType,
  resolveUsableWalletWithDevice,
  shouldApplyDeviceSettingMutationLocally,
} from './deviceStateManagement';

describe('device reset wallet isolation', () => {
  const firmwareTypeSwitchDeviceTypes = [
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
    EDeviceType.Pro,
  ];

  const unsupportedDeviceTypes = [
    EDeviceType.Classic,
    EDeviceType.Mini,
    EDeviceType.Touch,
    EDeviceType.Pro2,
    EDeviceType.Neo,
  ];

  it('keeps a deprecated hardware wallet available in device details', () => {
    expect(
      resolveUsableWalletWithDevice({
        wallet: {
          id: 'hw-wallet-1',
          deprecated: true,
          firmwareTypeAtCreated: EFirmwareType.BitcoinOnly,
        },
        device: {
          id: 'old-device-1',
          featuresInfo: {
            $app_firmware_type: EFirmwareType.BitcoinOnly,
          },
        },
      } as never),
    ).toBeDefined();
  });

  it('keeps an active mocked standard wallet as the hidden-only device proxy', () => {
    const walletWithDevice = {
      wallet: {
        id: 'hw-wallet-1',
        associatedDevice: 'device-1',
        deprecated: false,
        isMocked: true,
      },
      device: {
        id: 'device-1',
      },
    };

    expect(isDeviceManagementWalletUsable(walletWithDevice as never)).toBe(
      true,
    );
    expect(resolveUsableWalletWithDevice(walletWithDevice as never)).toBe(
      walletWithDevice,
    );
  });

  it('keeps a deprecated mocked wallet after a firmware switch', () => {
    expect(
      resolveUsableWalletWithDevice({
        wallet: {
          id: 'hw-wallet-1',
          deprecated: true,
          isMocked: true,
          firmwareTypeAtCreated: EFirmwareType.Universal,
        },
        device: {
          id: 'device-1',
          deviceType: EDeviceType.Pro,
          featuresInfo: {
            $app_firmware_type: EFirmwareType.BitcoinOnly,
          },
        },
      } as never),
    ).toBeDefined();
  });

  it.each(firmwareTypeSwitchDeviceTypes)(
    'keeps a deprecated %s wallet after switching firmware type',
    (deviceType) => {
      const walletWithDevice = {
        wallet: {
          id: `hw-wallet-${deviceType}`,
          deprecated: true,
          firmwareTypeAtCreated: EFirmwareType.Universal,
        },
        device: {
          id: `device-${deviceType}`,
          deviceType,
          featuresInfo: {
            deviceType,
            $app_firmware_type: EFirmwareType.BitcoinOnly,
          },
        },
      };

      expect(
        resolveUsableWalletWithDevice(walletWithDevice as never),
      ).toBeDefined();
    },
  );

  it.each(unsupportedDeviceTypes)(
    'keeps a deprecated %s wallet without a firmware type switch action',
    (deviceType) => {
      const walletWithDevice = {
        wallet: {
          id: `hw-wallet-${deviceType}`,
          deprecated: true,
          firmwareTypeAtCreated: EFirmwareType.Universal,
        },
        device: {
          id: `device-${deviceType}`,
          deviceType,
          deviceStateInfo: {
            identity: {
              deviceType,
              firmwareType: EFirmwareType.BitcoinOnly,
            },
          },
        },
      };

      expect(
        resolveUsableWalletWithDevice(walletWithDevice as never),
      ).toBeDefined();
    },
  );

  it('keeps a deprecated Bitcoin-only wallet after switching back to Universal firmware', () => {
    const walletWithDevice = {
      wallet: {
        id: 'hw-wallet-1',
        deprecated: true,
        firmwareTypeAtCreated: EFirmwareType.BitcoinOnly,
      },
      device: {
        id: 'device-1',
        deviceType: EDeviceType.Pro,
        featuresInfo: {
          $app_firmware_type: EFirmwareType.Universal,
        },
      },
    };

    expect(
      resolveUsableWalletWithDevice(walletWithDevice as never),
    ).toBeDefined();
  });

  it('keeps a deprecated Protocol V1 wallet from normalized firmwareType', () => {
    const walletWithDevice = {
      wallet: {
        id: 'legacy-classic1s-wallet',
        deprecated: true,
        firmwareTypeAtCreated: EFirmwareType.Universal,
      },
      device: {
        id: 'legacy-classic1s-device',
        deviceType: EDeviceType.Classic1s,
        featuresInfo: {
          deviceType: EDeviceType.Classic1s,
          firmwareType: EFirmwareType.BitcoinOnly,
        },
      },
    };

    expect(
      resolveUsableWalletWithDevice(walletWithDevice as never),
    ).toBeDefined();
  });

  it('keeps a deprecated legacy wallet without firmwareTypeAtCreated', () => {
    const walletWithDevice = {
      wallet: {
        id: 'legacy-hw-wallet-1',
        deprecated: true,
      },
      device: {
        id: 'device-1',
        deviceType: EDeviceType.Pro,
        deviceStateInfo: {
          identity: {
            firmwareType: EFirmwareType.BitcoinOnly,
          },
        },
      },
    };

    expect(
      resolveUsableWalletWithDevice(walletWithDevice as never),
    ).toBeDefined();
  });
});

describe('device management after a wallet reset', () => {
  const oldWallet = {
    wallet: { id: 'hw-old', deprecated: true },
    device: {
      id: 'db-old',
      uuid: 'SERIAL',
      deviceId: 'old-seed',
      connectId: '',
    },
  } as IHwQrWalletWithDevice;
  const currentWallet = {
    wallet: { id: 'hw-current', deprecated: false },
    device: {
      id: 'db-current',
      uuid: 'SERIAL',
      deviceId: 'new-seed',
      connectId: 'BLE-ID',
    },
  } as IHwQrWalletWithDevice;
  const otherWallet = {
    wallet: { id: 'hw-other' },
    device: {
      id: 'db-other',
      uuid: 'OTHER',
      deviceId: 'other-seed',
      connectId: 'BLE-ID',
    },
  } as IHwQrWalletWithDevice;

  it('opens the current device from a deprecated wallet without reviving it', () => {
    expect(
      resolveUsableWalletWithDevice(oldWallet, [
        oldWallet,
        otherWallet,
        currentWallet,
      ]),
    ).toBe(currentWallet);
    expect(oldWallet.wallet.deprecated).toBe(true);
  });

  it('lists one entry per physical device and prefers the current wallet', () => {
    expect(
      getDeviceManagementWallets([oldWallet, otherWallet, currentWallet]),
    ).toEqual([currentWallet, otherWallet]);
  });

  it('retains the device when only a deprecated wallet remains', () => {
    expect(getDeviceManagementWallets([oldWallet, otherWallet])).toEqual([
      oldWallet,
      otherWallet,
    ]);
    expect(
      resolveUsableWalletWithDevice(oldWallet, [oldWallet, otherWallet]),
    ).toBe(oldWallet);
  });

  it('preserves separate QR entries and the mocked standard proxy for hidden wallets', () => {
    const qrWallet = {
      ...currentWallet,
      wallet: { ...currentWallet.wallet, id: 'qr-current' },
    };
    const mockedWallet = {
      ...currentWallet,
      wallet: { ...currentWallet.wallet, isMocked: true },
    };
    const hiddenWallet = {
      ...currentWallet,
      wallet: {
        ...currentWallet.wallet,
        id: 'hw-hidden',
        passphraseState: 'hidden',
      },
    };
    expect(
      getDeviceManagementWallets([
        oldWallet,
        hiddenWallet,
        mockedWallet,
        qrWallet,
      ]),
    ).toEqual([mockedWallet, qrWallet]);
    expect(
      resolveUsableWalletWithDevice(hiddenWallet, [
        oldWallet,
        hiddenWallet,
        mockedWallet,
      ]),
    ).toBe(mockedWallet);
  });

  it('does not create management entries for missing wallets or devices', () => {
    expect(resolveUsableWalletWithDevice(undefined)).toBeUndefined();
    expect(
      getDeviceManagementWallets([
        { wallet: oldWallet.wallet, device: undefined },
      ]),
    ).toEqual([]);
  });
});

describe('device details navigation state', () => {
  it('uses the current DeviceState model when the database device is stale', () => {
    const staleDevice = {
      id: 'db-device-1',
      deviceType: EDeviceType.Unknown,
    };

    expect(resolveDeviceWithCurrentType(staleDevice, EDeviceType.Pro2)).toEqual(
      {
        id: 'db-device-1',
        deviceType: EDeviceType.Pro2,
      },
    );
  });
});

describe('device setting state updates', () => {
  it('only applies a confirmed passphrase mutation locally for Pro2', () => {
    expect(shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro2)).toBe(
      false,
    );
    expect(
      shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro2, {
        passphraseEnabled: false,
      }),
    ).toBe(true);
    expect(
      shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro2, {
        hapticFeedback: true,
      }),
    ).toBe(false);
    expect(shouldApplyDeviceSettingMutationLocally(EDeviceType.Pro)).toBe(true);
  });

  it('applies confirmed haptic feedback changes in both directions', () => {
    const enabled = mergeDeviceSettingState(
      { ...emptyMetaState, hapticFeedback: false },
      { hapticFeedback: true },
    );
    const disabled = mergeDeviceSettingState(enabled, {
      hapticFeedback: false,
    });

    expect(enabled.hapticFeedback).toBe(true);
    expect(disabled.hapticFeedback).toBe(false);
  });

  it('keeps brightness when only auto-lock changes', () => {
    const current = {
      ...emptyMetaState,
      brightness: 43,
      autoLockDelayMs: 30_000,
    };

    expect(
      mergeDeviceSettingState(current, { autoLockDelayMs: 60_000 }),
    ).toEqual({
      ...emptyMetaState,
      brightness: 43,
      autoLockDelayMs: 60_000,
    });
  });
});

describe('getDeviceStateSnapshotFromEvent', () => {
  it.each(['classic1s', 'touch', 'pro', 'pro2'])(
    'accepts a matching %s DeviceState event',
    (deviceType) => {
      const state = {
        identity: {
          deviceType,
          serialNo: `${deviceType}_SERIAL`,
          label: `Renamed ${deviceType}`,
        },
      };

      expect(
        getDeviceStateSnapshotFromEvent({
          device: {
            deviceType,
            connectId: `${deviceType}_USB`,
            uuid: `${deviceType}_SERIAL`,
          },
          event: {
            connectId: `${deviceType}_USB`,
            state,
          },
        } as never),
      ).toEqual({ state });
    },
  );

  it('ignores an event from another device', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'CURRENT' },
        event: {
          connectId: 'OTHER',
          state: { identity: { serialNo: 'OTHER_SERIAL' } },
        },
      } as never),
    ).toBeUndefined();
  });

  it('rejects a reused connect id when the serial number belongs to another device', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'REUSED', uuid: 'SERIAL-CURRENT' },
        event: {
          connectId: 'REUSED',
          state: { identity: { serialNo: 'SERIAL-OTHER' } },
        },
      } as never),
    ).toBeUndefined();
  });

  it('merges only changed fields and preserves trusted runtime state', () => {
    const currentState = {
      revision: 3,
      updatedAt: 300,
      identity: {
        deviceId: 'DEVICE_ID',
        serialNo: 'SERIAL',
        label: 'Desk wallet',
        bleName: 'Pro2 6136',
      },
      status: { mode: 'normal', unlocked: false },
      settings: { language: 'en-US' },
      versions: { firmware: '1.0.0' },
    };
    const snapshot = getDeviceStateSnapshotFromEvent({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'SERIAL',
        deviceId: 'DEVICE_ID',
      },
      currentState,
      event: {
        connectId: 'PRO2_USB',
        revision: 4,
        changedKeys: ['identity.bleName'],
        state: {
          ...currentState,
          revision: 4,
          updatedAt: 400,
          identity: {
            ...currentState.identity,
            deviceId: null,
            label: null,
            bleName: 'Pro2 9999',
          },
          status: { mode: 'normal', unlocked: null },
          settings: { language: null },
        },
      },
    } as never);

    expect(snapshot?.state.identity).toMatchObject({
      deviceId: 'DEVICE_ID',
      label: 'Desk wallet',
      bleName: 'Pro2 9999',
    });
    expect(snapshot?.state.status.unlocked).toBe(false);
    expect(snapshot?.state.settings.language).toBe('en-US');
  });

  it('refreshes all device settings in the page after a settings read', () => {
    const currentState = {
      revision: 3,
      updatedAt: 300,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal', unlocked: false },
      settings: { brightness: 30, autoLockDelayMs: 60_000 },
      versions: { firmware: '1.0.0' },
    };

    const snapshot = getDeviceStateSnapshotFromEvent({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'SERIAL',
        deviceId: 'DEVICE_ID',
      },
      currentState,
      event: {
        connectId: 'PRO2_USB',
        revision: 4,
        source: 'settings-read',
        changedKeys: ['settings.brightness'],
        state: {
          ...currentState,
          revision: 4,
          updatedAt: 400,
          status: { mode: 'normal', unlocked: true },
          settings: { brightness: 70, autoLockDelayMs: 300_000 },
        },
      },
    } as never);

    expect(snapshot?.state.settings).toMatchObject({
      brightness: 70,
      autoLockDelayMs: 300_000,
    });
    expect(snapshot?.state.status.unlocked).toBe(false);
  });

  it('applies a force-emitted settings read whose store revision did not change', () => {
    // On Protocol V1 the SDK cache can learn a device-side change (e.g.
    // language) before app listeners attach. The follow-up settings read then
    // finds nothing new, so the SDK force-emits with the OLD revision and
    // updatedAt. The event must still be applied.
    const currentState = {
      revision: 4,
      updatedAt: 400,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal', unlocked: true },
      settings: { language: 'zh_cn', brightness: 30 },
      versions: { firmware: '1.0.0' },
    };

    const snapshot = getDeviceStateSnapshotFromEvent({
      device: {
        connectId: 'PRO_BLE',
        uuid: 'SERIAL',
        deviceId: 'DEVICE_ID',
      },
      currentState,
      event: {
        connectId: 'PRO_BLE',
        revision: 4,
        source: 'settings-read',
        changedKeys: ['settings'],
        state: {
          ...currentState,
          settings: { language: 'zh_hk', brightness: 30 },
        },
      },
    } as never);

    expect(snapshot?.state.settings.language).toBe('zh_hk');
  });

  it('drops a same-timestamp settings read with a lower revision', () => {
    const currentState = {
      revision: 5,
      updatedAt: 400,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal' },
      settings: { language: 'zh_hk' },
      versions: { firmware: '1.0.0' },
    };

    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'PRO_BLE', uuid: 'SERIAL' },
        currentState,
        event: {
          connectId: 'PRO_BLE',
          revision: 4,
          source: 'settings-read',
          changedKeys: ['settings'],
          state: {
            ...currentState,
            revision: 4,
            settings: { language: 'zh_cn' },
          },
        },
      } as never),
    ).toBeUndefined();
  });

  it('still drops a settings read strictly older than the current state', () => {
    const currentState = {
      revision: 4,
      updatedAt: 400,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal' },
      settings: { language: 'zh_hk' },
      versions: { firmware: '1.0.0' },
    };

    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'PRO_BLE', uuid: 'SERIAL' },
        currentState,
        event: {
          connectId: 'PRO_BLE',
          revision: 3,
          source: 'settings-read',
          changedKeys: ['settings'],
          state: {
            ...currentState,
            revision: 3,
            updatedAt: 300,
            settings: { language: 'zh_cn' },
          },
        },
      } as never),
    ).toBeUndefined();
  });

  it('keeps dropping equal-revision events from non-authoritative sources', () => {
    const currentState = {
      revision: 4,
      updatedAt: 400,
      identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
      status: { mode: 'normal' },
      settings: { language: 'zh_cn' },
      versions: { firmware: '1.0.0' },
    };

    expect(
      getDeviceStateSnapshotFromEvent({
        device: { connectId: 'PRO_BLE', uuid: 'SERIAL' },
        currentState,
        event: {
          connectId: 'PRO_BLE',
          revision: 4,
          source: 'initialize',
          changedKeys: ['settings.language'],
          state: {
            ...currentState,
            settings: { language: 'zh_hk' },
          },
        },
      } as never),
    ).toBeUndefined();
  });

  it.each(['V1', 'V2'] as const)(
    'applies equal-metadata %s device-info versions from a hardware read-back',
    (protocol) => {
      const currentState = {
        protocol,
        revision: 4,
        updatedAt: 400,
        identity: { deviceId: 'DEVICE_ID', serialNo: 'SERIAL' },
        status: { mode: 'normal' },
        settings: { language: 'en-US' },
        versions: {
          firmware: '4.16.1',
          ble: '2.3.4',
          bootloader: '2.8.2',
        },
      };

      const snapshot = getDeviceStateSnapshotFromEvent({
        device: { connectId: 'CLASSIC_USB', uuid: 'SERIAL' },
        currentState,
        event: {
          connectId: 'CLASSIC_USB',
          revision: 4,
          source: 'device-info',
          changedKeys: [
            'versions.firmware',
            'versions.ble',
            'versions.bootloader',
          ],
          state: {
            ...currentState,
            versions: {
              firmware: '4.21.0',
              ble: '2.3.7',
              bootloader: '2.8.4',
            },
          },
        },
      } as never);

      expect(snapshot?.state.versions).toEqual({
        firmware: '4.21.0',
        ble: '2.3.7',
        bootloader: '2.8.4',
      });
    },
  );

  it('rejects a new wallet identity even when the physical serial still matches', () => {
    expect(
      getDeviceStateSnapshotFromEvent({
        device: {
          connectId: 'PRO2_USB',
          uuid: 'SERIAL',
          deviceId: 'OLD_DEVICE_ID',
        },
        currentState: {
          identity: {
            serialNo: 'SERIAL',
            deviceId: 'OLD_DEVICE_ID',
          },
        },
        event: {
          connectId: 'PRO2_USB',
          changedKeys: ['identity.deviceId'],
          state: {
            identity: {
              serialNo: 'SERIAL',
              deviceId: 'NEW_DEVICE_ID',
            },
          },
        },
      } as never),
    ).toBeUndefined();
  });
});

describe('DeviceState metadata projection', () => {
  it('uses the canonical device label when the persisted state has no displayName', () => {
    expect(
      getDeviceMetaStaticDataFromState({
        identity: {
          deviceType: 'pro2',
          firmwareType: 'universal',
          model: 'pro2',
          vendor: 'onekey.so',
          deviceId: '6C9F1443AF7400512AD1AD8D',
          serialNo: 'PR9999999999',
          label: 'My OneKey',
          bleName: 'Pro2 6136',
        },
        versions: { firmware: '1.0.0' },
      } as never),
    ).toEqual({
      deviceName: 'My OneKey',
      bleName: 'Pro2 6136',
      serialNo: 'PR9999999999',
      deviceType: 'pro2',
      firmwareType: 'universal',
      firmwareVersion: '1.0.0',
    });
  });

  it('uses the BLE name as the Pro2 secondary identifier', () => {
    expect(
      getDeviceSecondaryIdentifier({
        deviceType: EDeviceType.Pro2,
        bleName: 'Pro2 6136',
        serialNo: 'P2D33C0005B',
      }),
    ).toBe('Pro2 6136');

    expect(
      getDeviceSecondaryIdentifier({
        deviceType: EDeviceType.Pro2,
        bleName: '',
        serialNo: 'P2D33C0005B',
      }),
    ).toBe('P2D33C0005B');

    expect(
      getDeviceSecondaryIdentifier({
        deviceType: EDeviceType.Pro,
        bleName: 'Pro 6136',
        serialNo: 'SERIAL',
      }),
    ).toBe('SERIAL');
  });

  it('uses canonical state fields while retaining the V1 software-PIN preference', () => {
    expect(
      buildDeviceMetaStateFromState({
        isVerified: true,
        pinOnAppEnabled: true,
        state: {
          status: {
            unlocked: true,
            initialized: true,
            backupRequired: false,
            passphraseProtection: true,
          },
          settings: {
            language: 'en-US',
            autoLockDelayMs: 60_000,
          },
        } as never,
      }),
    ).toMatchObject({
      isVerified: true,
      unlocked: true,
      initialized: true,
      backupRequired: false,
      passphraseEnabled: true,
      pinOnAppEnabled: true,
      language: 'en-US',
      autoLockDelayMs: 60_000,
      isReady: true,
    });
  });

  it('uses the last trusted passphrase setting while Pro 2 is locked', () => {
    expect(
      buildDeviceMetaStateFromState({
        isVerified: true,
        state: {
          status: {
            unlocked: false,
            passphraseProtection: true,
          },
          settings: {},
        } as never,
      }),
    ).toMatchObject({
      unlocked: false,
      passphraseEnabled: true,
    });
  });

  it('prefers the newest event snapshot over persisted state', () => {
    const persistedState = { revision: 1 };
    const snapshotState = { revision: 2 };

    expect(
      resolveDeviceState({
        persistedState,
        snapshot: { state: snapshotState },
      } as never),
    ).toBe(snapshotState);
  });
});

describe('pickNewerDeviceStateSnapshot', () => {
  const buildSnapshot = (updatedAt: number, revision: number) =>
    ({ state: { updatedAt, revision } }) as never;

  it('keeps the applied event snapshot when a refresh serves older DB data', () => {
    const current = buildSnapshot(400, 4);
    const incoming = buildSnapshot(300, 3);

    expect(pickNewerDeviceStateSnapshot({ current, incoming })).toBe(current);
  });

  it('takes the incoming snapshot when it is newer', () => {
    const current = buildSnapshot(300, 3);
    const incoming = buildSnapshot(400, 4);

    expect(pickNewerDeviceStateSnapshot({ current, incoming })).toBe(incoming);
  });

  it('takes the incoming snapshot on equal stamps', () => {
    const current = buildSnapshot(400, 4);
    const incoming = buildSnapshot(400, 4);

    expect(pickNewerDeviceStateSnapshot({ current, incoming })).toBe(incoming);
  });

  it('never clears an existing snapshot with an empty refresh result', () => {
    const current = buildSnapshot(400, 4);

    expect(pickNewerDeviceStateSnapshot({ current, incoming: undefined })).toBe(
      current,
    );
    expect(
      pickNewerDeviceStateSnapshot({ current: undefined, incoming: current }),
    ).toBe(current);
    expect(
      pickNewerDeviceStateSnapshot({
        current: undefined,
        incoming: undefined,
      }),
    ).toBeUndefined();
  });
});
