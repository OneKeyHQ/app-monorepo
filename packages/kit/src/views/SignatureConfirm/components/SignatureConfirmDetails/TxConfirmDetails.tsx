import { memo, useCallback, useMemo } from 'react';

import { find, flatMap } from 'lodash';

import {
  useDecodedTxsAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IDisplayComponent,
  IDisplayComponentAssets,
} from '@onekeyhq/shared/types/signatureConfirm';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

import SignatureConfirmDetails from './SignatureConfirmDetails';

type IProps = {
  accountId: string;
  networkId: string;
};

function TxConfirmDetails(props: IProps) {
  const { accountId, networkId } = props;

  const [unsignedTxs] = useUnsignedTxsAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [{ isSendNativeTokenOnly }] = useSendTxStatusAtom();

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
      approveInfo?: IApproveInfo;
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
            approveInfo: unsignedTxs?.[i]?.approveInfo,
          })),
        ),
      );
    }

    return (
      <SignatureConfirmDetails
        accountId={accountId}
        networkId={networkId}
        displayComponents={txDisplayComponents}
        isBridge={isBridge}
        isMultiSignatures={isMultiTxs}
        isSendNativeTokenOnly={isSendNativeTokenOnly}
        nativeTokenTransferAmountToUpdate={nativeTokenTransferAmountToUpdate}
      />
    );
  }, [
    accountId,
    decodedTxs,
    isMultiTxs,
    networkId,
    unsignedTxs,
    isBridge,
    isSendNativeTokenOnly,
    nativeTokenTransferAmountToUpdate,
  ]);

  return (
    <SignatureConfirmItem gap="$5">
      {renderSignatureConfirmDetails()}
    </SignatureConfirmItem>
  );
}

export default memo(TxConfirmDetails);
