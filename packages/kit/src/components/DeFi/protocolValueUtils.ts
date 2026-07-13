import BigNumber from 'bignumber.js';

import type { IDeFiAsset, IDeFiProtocol } from '@onekeyhq/shared/types/defi';

export type IProtocolValueState = {
  value: number;
  hasAvailableValue: boolean;
  hasUnavailableValue: boolean;
};

type IProtocolPositionValueSection = {
  assetType: string;
  assets: IDeFiAsset[];
};

export function isProtocolValueUnavailable(
  value: IDeFiAsset['value'],
): boolean {
  const valueBN = new BigNumber(value);
  return !valueBN.isFinite();
}

export function isProtocolAssetValueUnavailable(
  asset: Pick<IDeFiAsset, 'amount' | 'price' | 'value'>,
): boolean {
  const valueBN = new BigNumber(asset.value);
  if (!valueBN.isFinite()) {
    return true;
  }

  const amountBN = new BigNumber(asset.amount);
  if (amountBN.isFinite() && amountBN.isZero()) {
    return false;
  }

  if (!valueBN.isZero()) {
    return false;
  }

  const priceBN = new BigNumber(asset.price);
  return !priceBN.isFinite() || priceBN.lte(0);
}

function addAssetToValueState({
  state,
  asset,
  sign,
}: {
  state: IProtocolValueState;
  asset: IDeFiAsset;
  sign: 1 | -1;
}) {
  if (isProtocolAssetValueUnavailable(asset)) {
    state.hasUnavailableValue = true;
  } else {
    state.value += sign * asset.value;
    state.hasAvailableValue = true;
  }
}

export function getProtocolPositionSectionsValueState(
  sections: IProtocolPositionValueSection[],
): IProtocolValueState {
  const state: IProtocolValueState = {
    value: 0,
    hasAvailableValue: false,
    hasUnavailableValue: false,
  };

  for (const section of sections) {
    const sign = section.assetType === 'borrowed' ? -1 : 1;
    for (const asset of section.assets) {
      addAssetToValueState({ state, asset, sign });
    }
  }

  return state;
}

export function getProtocolValueState(
  protocol: Pick<IDeFiProtocol, 'positions'>,
): IProtocolValueState {
  const state: IProtocolValueState = {
    value: 0,
    hasAvailableValue: false,
    hasUnavailableValue: false,
  };

  for (const position of protocol.positions) {
    for (const asset of position.assets) {
      addAssetToValueState({ state, asset, sign: 1 });
    }
    for (const reward of position.rewards) {
      addAssetToValueState({ state, asset: reward, sign: 1 });
    }
    for (const debt of position.debts) {
      addAssetToValueState({ state, asset: debt, sign: -1 });
    }
  }

  return state;
}
