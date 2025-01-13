import { memo, useCallback, useMemo } from 'react';

import { find, flatMap } from 'lodash';

import {
  useDecodedTxsAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type {
  IDisplayComponent,
  IDisplayComponentAssets,
} from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import {
  Address,
  Assets,
  Default,
  Divider,
  Network,
} from '../SignatureConfirmComponents';
import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  accountId: string;
  networkId: string;
};

function SignatureConfirmDetails(props: IProps) {
  const { accountId, networkId } = props;

  const [unsignedTxs] = useUnsignedTxsAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();

  const isMultiTxs = decodedTxs?.length > 1;

  const isBridge = useMemo(() => {
    const swapTx = find(unsignedTxs, 'swapInfo');

    if (!swapTx || !swapTx.swapInfo) return false;

    try {
      return (
        swapTx.swapInfo.sender.accountInfo.networkId !==
        swapTx.swapInfo.receiver.accountInfo.networkId
      );
    } catch (e) {
      return false;
    }
  }, [unsignedTxs]);

  const renderSignatureConfirmDetails = useCallback(() => {
    let txDisplayComponents: {
      component: IDisplayComponent;
      txIndex: number;
    }[] = [];

    const isLocalParsed = decodedTxs[0]?.isLocalParsed;

    for (let i = 0; i < decodedTxs.length; i += 1) {
      const decodedTx = decodedTxs[i];

      const components = decodedTx.txDisplay?.components ?? [];
      let finalComponents: IDisplayComponent[] = [];

      // merge token/nft components to assets component with same label
      if (isLocalParsed) {
        let currentLabel = '';
        let currentAssets: IDisplayComponentAssets | null = null;

        for (let j = 0; j < components.length; j += 1) {
          const component = components[j];

          if (
            component.type === EParseTxComponentType.Token ||
            component.type === EParseTxComponentType.NFT ||
            component.type === EParseTxComponentType.InternalAssets
          ) {
            if (currentLabel === component.label) {
              if (currentAssets) {
                currentAssets.assets.push(component);
              } else {
                currentLabel = component.label;
                currentAssets = {
                  type: EParseTxComponentType.Assets,
                  label: component.label,
                  assets: [component],
                };
              }
            } else {
              if (currentAssets) {
                finalComponents.push(currentAssets);
              }
              currentLabel = component.label;
              currentAssets = {
                type: EParseTxComponentType.Assets,
                label: component.label,
                assets: [component],
              };
            }
          } else {
            if (currentAssets) {
              finalComponents.push(currentAssets);
              currentAssets = null;
            }
            finalComponents.push(component);
          }
        }

        if (currentAssets) {
          finalComponents.push(currentAssets);
        }
      } else {
        finalComponents = components;
      }

      txDisplayComponents = flatMap(
        txDisplayComponents.concat(
          finalComponents.map((component) => ({
            component,
            txIndex: i,
          })),
        ),
      );
    }

    return txDisplayComponents.map(({ component, txIndex }) => {
      switch (component.type) {
        case EParseTxComponentType.Divider:
          return <Divider />;
        case EParseTxComponentType.Default:
          return <Default component={component} />;
        case EParseTxComponentType.Approve:
          return (
            <Assets.TokenApproval
              component={component}
              accountId={accountId}
              networkId={networkId}
              editable={!isMultiTxs}
              approveInfo={unsignedTxs?.[txIndex]?.approveInfo}
              showNetwork={isBridge}
            />
          );
        case EParseTxComponentType.Assets:
          return (
            <Assets
              component={component}
              networkId={networkId}
              showNetwork={isBridge}
            />
          );
        case EParseTxComponentType.InternalAssets:
          return (
            <Assets.InternalAssets
              component={component}
              networkId={networkId}
              showNetwork={isBridge}
            />
          );
        case EParseTxComponentType.Token:
          return (
            <Assets.Token
              component={component}
              networkId={networkId}
              showNetwork={isBridge}
            />
          );
        case EParseTxComponentType.NFT:
          return (
            <Assets.NFT
              component={component}
              networkId={networkId}
              showNetwork={isBridge}
            />
          );
        case EParseTxComponentType.Network:
          return <Network component={component} />;
        case EParseTxComponentType.Address:
          return (
            <Address
              component={component}
              accountId={accountId}
              networkId={networkId}
              showAddressLocalTags
            />
          );
        default:
          return null;
      }
    });
  }, [accountId, decodedTxs, isMultiTxs, networkId, unsignedTxs, isBridge]);

  return (
    <SignatureConfirmItem gap="$5">
      {renderSignatureConfirmDetails()}
    </SignatureConfirmItem>
  );
}

export default memo(SignatureConfirmDetails);
