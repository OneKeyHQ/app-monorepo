import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
  fetchMarketPresetConfig,
  getMarketPresetItem,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetSlippageValue,
} from './marketPresetSettings';

describe('marketPresetSettings', () => {
  it('returns fallback presets for the first enabled Market networks', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.bsc.id,
    });

    expect(config?.enabled).toBe(true);
    expect(config?.defaultPresetKey).toBe(EMarketPresetKey.AUTO);
    expect(config?.presets.map((item) => item.key)).toEqual([
      EMarketPresetKey.AUTO,
      EMarketPresetKey.P1,
      EMarketPresetKey.P2,
      EMarketPresetKey.P3,
    ]);
  });

  it('keeps unsupported networks on the legacy Market behavior', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.btc.id,
    });

    expect(config).toBeUndefined();
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
    expect(getMarketPresetSlippageValue({ preset, defaultSlippage: 0.5 })).toBe(
      0.5,
    );
    expect(getMarketPresetNetworkFeeLevel(preset)).toBe(
      ESwapNetworkFeeLevel.MEDIUM,
    );
  });

  it('maps preset fee levels to the existing gas fee pipeline', async () => {
    const config = await fetchMarketPresetConfig({
      networkId: presetNetworksMap.base.id,
    });

    const preset = getMarketPresetItem({
      config,
      presetKey: EMarketPresetKey.P2,
    });

    expect(preset?.priorityFee.type).toBe(EMarketPresetPriorityFeeType.FAST);
    expect(getMarketPresetSlippageValue({ preset, defaultSlippage: 0.5 })).toBe(
      1,
    );
    expect(getMarketPresetNetworkFeeLevel(preset)).toBe(
      ESwapNetworkFeeLevel.HIGH,
    );
  });
});
