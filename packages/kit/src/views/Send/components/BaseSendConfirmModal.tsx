import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { find, toLower } from 'lodash';
import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { NetworkCongestionThresholds } from '@onekeyhq/engine/src/types/network';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { isWatchingAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';
import { useTokenBalanceWithoutFrozen } from '../../../hooks/useTokens';
import { EditableNonceStatusEnum } from '../types';

import { BaseSendModal } from './BaseSendModal';
import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendConfirmErrorBoundary } from './SendConfirmErrorBoundary';
import { SendConfirmErrorsAlert } from './SendConfirmErrorsAlert';

import type { ITxConfirmViewProps } from '../types';

// TODO rename SendConfirmModalBase
export function BaseSendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { network, networkImpl, networkId, accountId, accountAddress } =
    useActiveSideAccount(props);
  const {
    children,
    encodedTx,
    decodedTx,
    confirmDisabled,
    feeInfoPayload,
    feeInfoLoading,
    handleConfirm,
    updateEncodedTxBeforeConfirm,
    autoConfirm,
    sourceInfo,
    advancedSettings,
    ...others
  } = props;
  const nativeToken = useNativeToken(network?.id);

  const modalClose = useModalClose();

  const nativeBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: nativeToken,
    fallback: '0',
  });

  // TODO move to validator
  const fee = feeInfoPayload?.current?.totalNative ?? '0';

  const isAutoConfirmed = useRef(false);
  const [pendingTxCount, setPendingTxCount] = useState('0');
  const [
    isPendingTxSameNonceWithLowerGas,
    setIsPendingTxSameNonceWithLowerGas,
  ] = useState(false);
  const [isPendingTxSameNonce, setIsPendingTxSameNonce] = useState(false);

  const balanceInsufficient = useMemo(
    () => new BigNumber(nativeBalance).lt(new BigNumber(fee)),
    [fee, nativeBalance],
  );

  const editableNonceStatus = useMemo(() => {
    if (network?.settings.nonceEditable && advancedSettings?.currentNonce) {
      const currentNonceBN = new BigNumber(advancedSettings.currentNonce);
      const originNonceBN = new BigNumber(advancedSettings.originNonce);
      if (currentNonceBN.isLessThan(originNonceBN)) {
        return EditableNonceStatusEnum.Less;
      }
      if (currentNonceBN.isGreaterThan(originNonceBN)) {
        return EditableNonceStatusEnum.Greater;
      }

      return EditableNonceStatusEnum.Equal;
    }
    return EditableNonceStatusEnum.None;
  }, [advancedSettings, network]);

  const isWatching = useMemo(
    () => isWatchingAccount({ accountId }),
    [accountId],
  );

  const isAccountNotMatched = useMemo(() => {
    if (!encodedTx) {
      return false;
    }
    if (networkImpl === IMPL_EVM) {
      const tx = encodedTx as IEncodedTxEvm | undefined;
      if (
        tx &&
        accountAddress &&
        toLower(tx.from) !== toLower(accountAddress)
      ) {
        return true;
      }
    }
    return false;
  }, [accountAddress, encodedTx, networkImpl]);

  const isNetworkBusy = useMemo(() => {
    const info = feeInfoPayload?.info;
    if (info?.eip1559 && info.extraInfo?.networkCongestion) {
      return (
        info.extraInfo.networkCongestion >= NetworkCongestionThresholds.busy
      );
    }
    return false;
  }, [feeInfoPayload?.info]);

  const isLowMaxFee = useMemo(() => {
    const custom = feeInfoPayload?.selected.custom;
    if (feeInfoPayload?.info.eip1559 || custom?.eip1559) {
      if (feeInfoPayload?.selected.type === 'preset') {
        return feeInfoPayload?.selected.preset === '0';
      }
      return custom?.similarToPreset === '0';
    }
  }, [
    feeInfoPayload?.info.eip1559,
    feeInfoPayload?.selected.custom,
    feeInfoPayload?.selected.preset,
    feeInfoPayload?.selected.type,
  ]);

  const confirmAction = useCallback(
    async ({ close, onClose }) => {
      let tx = encodedTx;
      if (!tx) {
        return;
      }
      if (updateEncodedTxBeforeConfirm) {
        tx = await updateEncodedTxBeforeConfirm(tx);
      }
      handleConfirm({ close, onClose, encodedTx: tx });
    },
    [encodedTx, handleConfirm, updateEncodedTxBeforeConfirm],
  );
  useEffect(() => {
    if (autoConfirm && !feeInfoLoading && !isAutoConfirmed.current) {
      isAutoConfirmed.current = true;
      setTimeout(() => {
        confirmAction({ close: modalClose });
      }, 600);
    }
  }, [feeInfoLoading, autoConfirm, confirmAction, modalClose]);

  useEffect(() => {
    const getPendingTxCount = async () => {
      let count = '0';
      let pendingTxs = await backgroundApiProxy.serviceHistory.getLocalHistory({
        accountId,
        networkId,
        isPending: true,
        limit: 10,
      });

      pendingTxs = pendingTxs.filter((tx) => {
        const action = tx.decodedTx.actions[0];
        if (
          action.direction === IDecodedTxDirection.OUT ||
          action.direction === IDecodedTxDirection.SELF
        ) {
          if (advancedSettings?.currentNonce) {
            if (
              new BigNumber(advancedSettings.currentNonce).isLessThanOrEqualTo(
                tx.decodedTx.nonce,
              )
            ) {
              return false;
            }
          }
          return true;
        }

        return false;
      });

      count = pendingTxs.length.toString();

      setPendingTxCount(count);
    };

    getPendingTxCount();
  }, [accountId, advancedSettings?.currentNonce, networkId]);

  useEffect(() => {
    const checkPendingTxWithSameNonce = async () => {
      const localPendingTxs =
        await backgroundApiProxy.serviceHistory.getLocalHistory({
          networkId,
          accountId,
          isPending: true,
          limit: 50,
        });
      // only check networks where both fee and nonce are editable
      if (
        network?.settings.nonceEditable &&
        network.settings.feeInfoEditable &&
        advancedSettings?.currentNonce
      ) {
        const feeInfoValue = feeInfoPayload?.current.value;
        const localPendingTxWithSameNonce = find(localPendingTxs, (tx) =>
          new BigNumber(advancedSettings.currentNonce).isEqualTo(
            tx.decodedTx.nonce,
          ),
        );

        if (localPendingTxWithSameNonce) {
          setIsPendingTxSameNonce(true);
          const { feeInfo } = localPendingTxWithSameNonce.decodedTx;
          if (feeInfo && feeInfoValue) {
            if (feeInfo.eip1559) {
              if (
                new BigNumber(
                  feeInfo.price1559?.maxFeePerGas ?? 0,
                ).isGreaterThanOrEqualTo(
                  feeInfoValue.price1559?.maxFeePerGas ?? 0,
                ) ||
                new BigNumber(
                  feeInfo.price1559?.maxPriorityFeePerGas ?? 0,
                ).isGreaterThanOrEqualTo(
                  feeInfoValue.price1559?.maxPriorityFeePerGas ?? 0,
                )
              ) {
                setIsPendingTxSameNonceWithLowerGas(true);
                return;
              }
            } else if (
              new BigNumber(feeInfo.price ?? 0).isGreaterThanOrEqualTo(
                feeInfoValue.price ?? 0,
              )
            ) {
              setIsPendingTxSameNonceWithLowerGas(true);
              return;
            }
          }
        } else {
          setIsPendingTxSameNonce(false);
        }
      }

      setIsPendingTxSameNonceWithLowerGas(false);
    };
    checkPendingTxWithSameNonce();
  }, [
    accountId,
    advancedSettings?.currentNonce,
    feeInfoPayload,
    network?.settings?.feeInfoEditable,
    network?.settings?.nonceEditable,
    networkId,
  ]);

  return (
    <BaseSendModal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled:
          isWatching ||
          balanceInsufficient ||
          isAccountNotMatched ||
          feeInfoLoading ||
          !feeInfoPayload ||
          !encodedTx ||
          !decodedTx ||
          confirmDisabled,
      }}
      secondaryActionTranslationId="action__cancel"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      onSecondaryActionPress={({ close }) => close()}
      onPrimaryActionPress={confirmAction}
      {...others}
      scrollViewProps={{
        children: (
          <>
            {!autoConfirm && (
              <SendConfirmErrorsAlert
                networkId={networkId}
                accountAddress={accountAddress}
                nativeToken={nativeToken}
                isWatchingAccount={isWatching}
                balanceInsufficient={balanceInsufficient}
                isAccountNotMatched={isAccountNotMatched}
                editableNonceStatus={editableNonceStatus}
                isNetworkBusy={isNetworkBusy}
                isLowMaxFee={isLowMaxFee}
                pendingTxCount={pendingTxCount}
                isPendingTxSameNonce={isPendingTxSameNonce}
                isPendingTxSameNonceWithLowerGas={
                  isPendingTxSameNonceWithLowerGas
                }
              />
            )}

            <SendConfirmErrorBoundary>
              {children}
              <DecodeTxButtonTest
                accountId={accountId}
                networkId={networkId}
                encodedTx={encodedTx}
                feeInfoPayload={feeInfoPayload}
              />
            </SendConfirmErrorBoundary>

            {platformEnv.isDev ? (
              <Text>
                {nativeBalance} {nativeToken?.symbol}
              </Text>
            ) : null}
          </>
        ),
      }}
    />
  );
}
