import { Cell } from '@ton/core';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponent,
  type IDisplayComponentAssets,
} from '@onekeyhq/shared/types/signatureConfirm';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { normalizeTonAddress } from '../../vaults/impls/ton/sdkTon/transactionParser';

type IAsset = IDisplayComponentAssets['assets'][number];

function getRequestedNftOwner(payload: string | undefined) {
  if (!payload) return undefined;
  try {
    const roots = Cell.fromBoc(Buffer.from(payload, 'base64'));
    if (roots.length !== 1) return undefined;
    const slice = roots[0].beginParse();
    if (slice.loadUint(32) !== 0x5f_cc_3d_14) return undefined;
    slice.loadUintBig(64);
    const owner = slice.loadAddress();
    slice.loadMaybeAddress();
    slice.loadMaybeRef();
    slice.loadCoins();
    if (slice.loadBit()) {
      slice.loadRef();
      slice.endParse();
    }
    // Read the signed TEP-62 request without claiming a verified NFT identity.
    return owner.toString({ bounceable: false });
  } catch {
    return undefined;
  }
}

export function mergeTonUnknownServerDisplay({
  decodedTx,
  encodedTx,
  localComponents,
  serverComponents,
}: {
  decodedTx: IDecodedTx;
  encodedTx: IEncodedTxTon | undefined;
  localComponents: IDisplayComponent[];
  serverComponents: IDisplayComponent[];
}): IDisplayComponent[] {
  const knownJettons = new Set<string>();
  let hasNativeOutflow = false;
  for (const action of decodedTx.actions) {
    for (const transfer of action.assetTransfer?.sends ?? []) {
      if (transfer.isNative) {
        hasNativeOutflow = true;
      } else if (transfer.tokenIdOnNetwork) {
        knownJettons.add(normalizeTonAddress(transfer.tokenIdOnNetwork));
      }
    }
  }

  const preserveAsset = (
    asset: IAsset,
    simulation = false,
  ): IAsset | undefined => {
    if (asset.type === EParseTxComponentType.NFT) return asset;
    if (asset.type === EParseTxComponentType.InternalAssets) {
      // Legacy rows have no asset identity; never infer one from their symbol.
      return asset.isNFT ? asset : undefined;
    }
    if (asset.networkId && asset.networkId !== decodedTx.networkId)
      return asset;
    const token = asset.token.info;
    if (token.address && knownJettons.has(normalizeTonAddress(token.address))) {
      return undefined;
    }
    if (token.address === '' && token.isNative !== false) {
      // Simulation reports net effects, whereas local native sends are gross requests.
      return simulation ||
        !hasNativeOutflow ||
        asset.transferDirection === ETransferDirection.In
        ? asset
        : undefined;
    }
    return token.isNative !== true && TonWeb.Address.isValid(token.address)
      ? asset
      : undefined;
  };

  const components = [...localComponents];
  const addresses = new Set(
    components.flatMap((component) =>
      component.type === EParseTxComponentType.Address
        ? [normalizeTonAddress(component.address)]
        : [],
    ),
  );
  const requestedOwners = new Map<string, string>();
  for (const message of encodedTx?.messages ?? []) {
    const owner = getRequestedNftOwner(message.payload);
    if (owner && !addresses.has(normalizeTonAddress(owner))) {
      requestedOwners.set(normalizeTonAddress(owner), owner);
    }
  }
  const appendRequestedOwner = (key: string, owner: string) => {
    addresses.add(key);
    requestedOwners.delete(key);
    components.push({
      type: EParseTxComponentType.Address,
      label: appLocale.intl.formatMessage({ id: ETranslations.global_to }),
      address: owner,
      tags: [],
      highlight: true,
      isNavigable: false,
    });
  };

  for (const component of serverComponents) {
    if (
      component.type === EParseTxComponentType.Assets ||
      component.type === EParseTxComponentType.Simulation
    ) {
      const assets = component.assets.flatMap((asset) => {
        const preserved = preserveAsset(
          asset,
          component.type === EParseTxComponentType.Simulation,
        );
        return preserved ? [preserved] : [];
      });
      if (
        assets.length ||
        component.type === EParseTxComponentType.Simulation
      ) {
        components.push({ ...component, assets });
      }
    } else if (
      component.type === EParseTxComponentType.NFT ||
      component.type === EParseTxComponentType.Token ||
      component.type === EParseTxComponentType.InternalAssets
    ) {
      const asset = preserveAsset(component);
      if (asset) components.push(asset);
    } else if (component.type === EParseTxComponentType.Address) {
      const key = normalizeTonAddress(component.address);
      if (!addresses.has(key)) {
        const owner = requestedOwners.get(key);
        if (owner) {
          appendRequestedOwner(key, owner);
        } else {
          addresses.add(key);
          // Flat server rows cannot attribute a recipient to an individual message.
          components.push({
            ...component,
            label: appLocale.intl.formatMessage({
              id: ETranslations.global_address,
            }),
            role: undefined,
            highlight: false,
          });
        }
      }
    }
  }
  for (const [key, owner] of requestedOwners) {
    appendRequestedOwner(key, owner);
  }
  return components;
}
