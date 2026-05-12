import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  ESwapNetworkFeeLevel,
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
  type ISwapProSpeedConfig,
} from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
  EMarketPresetSlippageWarningType,
  EMarketPresetTradeSide,
  fetchMarketPresetConfig,
  getMarketPresetCustomizedMap,
  getMarketPresetDefaultEditableDirectionSettingsForPreset,
  getMarketPresetItem,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetPriorityFeeCustomPlaceholder,
  getMarketPresetPriorityFeeOverride,
  getMarketPresetSlippageCustomStatus,
  getMarketPresetSlippageValue,
  isMarketPresetConfirmDisabled,
  resolveMarketPresetDirectionSettings,
} from './marketPresetSettings';

function buildSpeedConfigWithMarketPresetConfig(
  marketPresetConfig: unknown,
): ISwapProSpeedConfig {
  const speedConfig: ISwapProSpeedConfig & { marketPresetConfig: unknown } = {
    slippage: 0.5,
    spenderAddress: '',
    defaultTokens: [],
    defaultLimitTokens: [],
    swapMevNetConfig: [],
    marketPresetConfig,
  };
  return speedConfig;
}

describe('marketPresetSettings', () => {
  it('returns hardcoded dashboard presets from the Promise adapter', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.bsc.id,
    });

    expect(config?.enabled).toBe(true);
    expect(config?.priorityFee.editable).toBe(true);
    expect(config?.priorityFee.customUnit).toBe('Gwei');
    expect(config?.priorityFee.supportedTypes).toEqual([
      EMarketPresetPriorityFeeType.MARKET,
      EMarketPresetPriorityFeeType.FAST,
      EMarketPresetPriorityFeeType.CUSTOM,
    ]);
    expect(config?.defaultPresetKey).toBe(EMarketPresetKey.AUTO);
    expect(config?.presets.map((item) => item.key)).toEqual([
      EMarketPresetKey.AUTO,
      EMarketPresetKey.P1,
      EMarketPresetKey.P2,
      EMarketPresetKey.P3,
    ]);
  });

  it('returns undefined for networks without a market preset dashboard config', async () => {
    // Networks not in the hardcoded EVM/SOL/READONLY allowlist have no Market
    // preset coverage. Returning undefined keeps the standard slippage control
    // visible and avoids forcing default Auto on unsupported networks.
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.btc.id,
    });

    expect(config).toBeUndefined();

    const settings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P1,
      tradeSide: EMarketPresetTradeSide.BUY,
      savedSettings: {
        presets: {
          [EMarketPresetKey.P1]: {
            [EMarketPresetTradeSide.BUY]: {
              slippage: {
                key: ESwapSlippageSegmentKey.CUSTOM,
                value: 1,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.CUSTOM,
                customValue: '1',
              },
            },
          },
        },
      },
    });

    // Without a config, resolveMarketPresetDirectionSettings still safely
    // collapses to the default AUTO state.
    expect(settings.slippage.key).toBe(ESwapSlippageSegmentKey.AUTO);
    expect(settings.priorityFee.type).toBe(EMarketPresetPriorityFeeType.AUTO);
  });

  it('removes the Fast priority fee option from Solana presets', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.sol.id,
    });

    expect(config?.priorityFee.editable).toBe(true);
    expect(config?.priorityFee.customUnit).toBe('SOL');
    expect(config?.priorityFee.supportedTypes).toEqual([
      EMarketPresetPriorityFeeType.MARKET,
      EMarketPresetPriorityFeeType.CUSTOM,
    ]);

    const settings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P1,
      tradeSide: EMarketPresetTradeSide.BUY,
      savedSettings: {
        presets: {
          [EMarketPresetKey.P1]: {
            [EMarketPresetTradeSide.BUY]: {
              slippage: {
                key: ESwapSlippageSegmentKey.AUTO,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.FAST,
              },
            },
          },
        },
      },
    });

    expect(settings.priorityFee.type).toBe(EMarketPresetPriorityFeeType.MARKET);
  });

  it('lets speed-config disable Market presets before local fallback', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.eth.id,
      speedConfig: buildSpeedConfigWithMarketPresetConfig({
        enabled: false,
        customPriorityFeeRange: {
          min: '0',
          max: '4000',
        },
      }),
    });

    expect(config?.enabled).toBe(false);
    expect(
      getMarketPresetItem({
        config,
        presetKey: EMarketPresetKey.P1,
      }),
    ).toBeUndefined();

    const settings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P1,
      tradeSide: EMarketPresetTradeSide.BUY,
      savedSettings: {
        selectedPresetKey: EMarketPresetKey.P1,
        presets: {
          [EMarketPresetKey.P1]: {
            [EMarketPresetTradeSide.BUY]: {
              slippage: {
                key: ESwapSlippageSegmentKey.CUSTOM,
                value: 1,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.CUSTOM,
                customValue: '1',
              },
            },
          },
        },
      },
    });

    expect(settings.slippage.key).toBe(ESwapSlippageSegmentKey.AUTO);
    expect(settings.priorityFee.type).toBe(EMarketPresetPriorityFeeType.AUTO);
    expect(
      getMarketPresetPriorityFeeOverride(settings, config),
    ).toBeUndefined();
  });

  it('uses configured priority fee range for placeholder, validation, and override', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.base.id,
      speedConfig: buildSpeedConfigWithMarketPresetConfig({
        enabled: true,
        customPriorityFeeRange: {
          min: '0',
          max: '250',
        },
      }),
    });

    expect(getMarketPresetPriorityFeeCustomPlaceholder(config)).toBe('0 ~ 250');

    const validSettings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P2,
      tradeSide: EMarketPresetTradeSide.SELL,
      savedSettings: {
        presets: {
          [EMarketPresetKey.P2]: {
            [EMarketPresetTradeSide.SELL]: {
              slippage: {
                key: ESwapSlippageSegmentKey.AUTO,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.CUSTOM,
                customValue: '250',
              },
            },
          },
        },
      },
    });
    expect(getMarketPresetPriorityFeeOverride(validSettings, config)).toEqual({
      customValue: '250',
      customRange: {
        min: '0',
        max: '250',
      },
    });

    const invalidSettings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P2,
      tradeSide: EMarketPresetTradeSide.SELL,
      savedSettings: {
        presets: {
          [EMarketPresetKey.P2]: {
            [EMarketPresetTradeSide.SELL]: {
              slippage: {
                key: ESwapSlippageSegmentKey.AUTO,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.CUSTOM,
                customValue: '250.01',
              },
            },
          },
        },
      },
    });
    expect(getMarketPresetNetworkFeeLevel(invalidSettings, config)).toBe(
      ESwapNetworkFeeLevel.MEDIUM,
    );
    expect(
      getMarketPresetPriorityFeeOverride(invalidSettings, config),
    ).toBeUndefined();
  });

  it('falls back to Auto when the selected preset is unavailable', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.eth.id,
    });

    const preset = getMarketPresetItem({
      config,
      presetKey: 'removed-preset' as EMarketPresetKey,
    });

    expect(preset?.key).toBe(EMarketPresetKey.AUTO);
  });

  it('keeps P1/P2/P3 defaults equivalent to Auto before customization', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.base.id,
    });

    const settings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P3,
      tradeSide: EMarketPresetTradeSide.BUY,
    });

    expect(settings.slippage.key).toBe(ESwapSlippageSegmentKey.AUTO);
    expect(settings.priorityFee.type).toBe(EMarketPresetPriorityFeeType.MARKET);
    expect(
      getMarketPresetSlippageValue({ settings, defaultSlippage: 0.5 }),
    ).toBe(0.5);
    expect(getMarketPresetNetworkFeeLevel(settings)).toBe(
      ESwapNetworkFeeLevel.MEDIUM,
    );
  });

  it('uses editable preset defaults with empty custom fee', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.base.id,
    });

    const settings = getMarketPresetDefaultEditableDirectionSettingsForPreset({
      config,
      presetKey: EMarketPresetKey.P1,
    });

    expect(settings.slippage).toEqual({
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 1,
    });
    expect(settings.priorityFee).toEqual({
      type: EMarketPresetPriorityFeeType.CUSTOM,
      customValue: '',
    });
  });

  it('resolves saved preset settings per network direction', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.base.id,
    });

    const settings = resolveMarketPresetDirectionSettings({
      config,
      presetKey: EMarketPresetKey.P2,
      tradeSide: EMarketPresetTradeSide.SELL,
      savedSettings: {
        presets: {
          [EMarketPresetKey.P2]: {
            [EMarketPresetTradeSide.SELL]: {
              slippage: {
                key: ESwapSlippageSegmentKey.CUSTOM,
                value: 1,
              },
              priorityFee: {
                type: EMarketPresetPriorityFeeType.FAST,
              },
            },
          },
        },
      },
    });

    expect(
      getMarketPresetSlippageValue({ settings, defaultSlippage: 0.5 }),
    ).toBe(1);
    expect(getMarketPresetNetworkFeeLevel(settings)).toBe(
      ESwapNetworkFeeLevel.HIGH,
    );
    expect(
      getMarketPresetCustomizedMap({
        presets: {
          [EMarketPresetKey.P2]: {
            [EMarketPresetTradeSide.SELL]: settings,
          },
        },
      })[EMarketPresetKey.P2],
    ).toBe(true);
  });

  it.each([
    [
      0.05,
      ESwapSlippageCustomStatus.WRONG,
      EMarketPresetSlippageWarningType.WILL_FAIL,
    ],
    [0.06, ESwapSlippageCustomStatus.NORMAL, undefined],
    [10, ESwapSlippageCustomStatus.NORMAL, undefined],
    [
      10.01,
      ESwapSlippageCustomStatus.WRONG,
      EMarketPresetSlippageWarningType.WILL_AHEAD,
    ],
    [
      50,
      ESwapSlippageCustomStatus.WRONG,
      EMarketPresetSlippageWarningType.WILL_AHEAD,
    ],
    [50.01, ESwapSlippageCustomStatus.ERROR, undefined],
  ])(
    'resolves custom slippage %s validation status',
    (value, status, warningType) => {
      const result = getMarketPresetSlippageCustomStatus({
        slippage: {
          key: ESwapSlippageSegmentKey.CUSTOM,
          value,
        },
        priorityFee: {
          type: EMarketPresetPriorityFeeType.MARKET,
        },
      });

      expect(result.status).toBe(status);
      expect(result.warningType).toBe(warningType);
    },
  );

  it('keeps Auto confirmation enabled when edited preset drafts are invalid', () => {
    expect(
      isMarketPresetConfirmDisabled({
        activePresetKey: EMarketPresetKey.AUTO,
        currentSettingsInvalid: false,
        hasInvalidDirtySettings: true,
      }),
    ).toBe(false);
    expect(
      isMarketPresetConfirmDisabled({
        activePresetKey: EMarketPresetKey.P1,
        currentSettingsInvalid: false,
        hasInvalidDirtySettings: true,
      }),
    ).toBe(true);
  });
});
