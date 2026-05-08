import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  DashText,
  Dialog,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useCustomFeeAtom,
  useDecodedTxsAtom,
  useEffectiveFeePayerAtom,
  useExtraFeeInfoAtom,
  useGasAccountTemporarilyDisabledAtom,
  useGasAccountUiStateAtom,
  useIsSinglePresetAtom,
  useMegafuelEligibleAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePayWithTokenInfoAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeAtom,
  useSendTxStatusAtom,
  useSignatureConfirmActions,
  useTokenTransferAmountAtom,
  useTronResourceRentalInfoAtom,
  useTxAdvancedSettingsAtom,
  useTxFeeInfoInitAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  tronTokenAddressMainnet,
  tronTokenAddressTestnet,
} from '@onekeyhq/shared/src/consts/chainConsts';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { IMPL_APTOS } from '@onekeyhq/shared/src/engine/engineConsts';
import type {
  IOneKeyError,
  IOneKeyRpcError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { getGasAccountErrorCode } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import {
  calculateFeeForSend,
  calculateTotalFeeRange,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/shared/src/utils/feeUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ALGO_TX_MIN_FEE } from '@onekeyhq/shared/types/algo';
import {
  EFeeType,
  ESendFeeStatus,
  ETronResourceRentalPayType,
} from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
  IGasAccountScenario,
  IGasPayer,
  IMultiTxsFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
} from '../../constants/gasAccountErrorCodes';

import { buildPresetMultiTxsFee } from './presetFeeInfoUtils';
import { TxFeeEditor } from './TxFeeEditor';
import { TxFeeSelectorTrigger } from './TxFeeSelectorTrigger';

type IProps = {
  accountId: string;
  networkId: string;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  tableLayout?: boolean;
  feeInfoWrapperProps?: React.ComponentProps<typeof Stack>;
  transferPayload?: ITransferPayload;
  gasAccountScenario?: IGasAccountScenario;
};

const SPONSORED_COUPON_INFO_WIDTH = 56;
const SPONSORED_COUPON_SEPARATOR_STROKE = 2;
const SPONSORED_COUPON_CUTOUT_SIZE = 18;
const SPONSORED_COUPON_CUTOUT_OFFSET = SPONSORED_COUPON_CUTOUT_SIZE / 2;
const SPONSORED_FEES_HELP_CENTER_URL =
  'https://help.onekey.so/collections/15988402';

function buildGasAccountIdempotencyKey(quoteId?: string) {
  return quoteId ? `gas-account:${quoteId}` : '';
}

function TxFeeInfo(props: IProps) {
  const {
    accountId,
    networkId,
    useFeeInTx,
    feeInfoEditable = true,
    feeInfoWrapperProps,
    transferPayload,
    gasAccountScenario,
  } = props;
  const intl = useIntl();
  const theme = useTheme();
  const themeName = useThemeName();
  const feeInTxUpdated = useRef(false);
  const tronRentalUpdated = useRef(false);
  const lastTxUuidRef = useRef<string | undefined>(undefined);
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [isSinglePreset] = useIsSinglePresetAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [txAdvancedSettings] = useTxAdvancedSettingsAtom();
  const [extraFeeInfo] = useExtraFeeInfoAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [tronResourceRentalInfo] = useTronResourceRentalInfoAtom();
  const [payWithTokenInfo] = usePayWithTokenInfoAtom();
  const [tokenTransferAmount] = useTokenTransferAmountAtom();
  const [megafuelEligible] = useMegafuelEligibleAtom();
  const [effectiveFeePayer] = useEffectiveFeePayerAtom();
  const [gasAccountTemporarilyDisabled] =
    useGasAccountTemporarilyDisabledAtom();
  const [gasAccountUiState] = useGasAccountUiStateAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
  const currentTxUuid = unsignedTxs[0]?.uuid;
  const feeRequestIdRef = useRef(0);
  const currentTxUuidRef = useRef<string | undefined>(currentTxUuid);
  currentTxUuidRef.current = currentTxUuid;
  const {
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    payTokenInfo,
    payType,
    isSwapTrxEnabled,
  } = tronResourceRentalInfo;
  const {
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateSendTxStatus,
    updateCustomFee,
    updateSendSelectedFee,
    updateIsSinglePreset,
    updateTxAdvancedSettings,
    updateTronResourceRentalInfo,
    resetTronResourceRentalInfo,
    updatePayWithTokenInfo,
    resetPayWithTokenInfo,
    updateMegafuelEligible,
    resetMegafuelEligible,
    updateEffectiveFeePayer,
    resetGasAccountTemporarilyDisabled,
    updateGasAccountTemporarilyDisabled,
    updateGasAccountUiState,
    resetGasAccountUiState,
    updateTxFeeInfoInit,
    resetTxFeeState,
  } = useSignatureConfirmActions().current;

  const isMultiTxs = unsignedTxs.length > 1;
  const gasAccountQuote = gasAccountUiState.gasAccountQuote;
  const gasAccountMaxFee = gasAccountQuote?.maxFee ?? '0';
  const isGasAccountEligible =
    gasAccountUiState.gasAccountEligible && !!gasAccountQuote?.quoteId;
  const isGasAccountSelected =
    isGasAccountEligible && gasAccountUiState.selectedPayer === 'gasAccount';
  const isMegafuelSponsored =
    effectiveFeePayer === 'megafuel' || megafuelEligible.sponsorable;
  const isGasAccountSponsored = effectiveFeePayer === 'gasAccount';
  const isPayerManagedByService = isMegafuelSponsored || isGasAccountSponsored;
  const isDarkMode = /dark/.test(themeName);
  const gasSponsoredAccentColor = theme.bgAccent.val;
  const sponsoredCouponBgColor = theme.brand3.val;
  const sponsoredCouponTextColor = theme.text.val;
  const sponsoredCouponSubTextColor = theme.textSubdued.val;
  const sponsoredCouponIconBgColor = isDarkMode
    ? theme.brand8.val
    : gasSponsoredAccentColor;
  const sponsoredCouponSeparatorColor = theme.borderSubdued.val;

  // For non-HD wallets, approve&swap transactions will be sent as separate consecutive transactions,
  // each requiring individual confirmation
  // (HD wallets only need to display one transaction confirmation page containing all information)
  // The fee for this swap transaction cannot be estimated via RPC,
  // it must be calculated based on the previous approve transaction fee
  const isLastSwapTxWithFeeInfo = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      unsignedTxs[0].swapInfo &&
      unsignedTxs[0].feeInfo,
    [unsignedTxs],
  );

  const isSingleTxWithFeesInfo = useMemo(
    () => unsignedTxs.length === 1 && unsignedTxs[0].feesInfo,
    [unsignedTxs],
  );

  const isSecondApproveTxWithFeeInfo = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      unsignedTxs[0].approveInfo &&
      unsignedTxs[0].feeInfo,
    [unsignedTxs],
  );

  const { result: [vaultSettings, network, defaultCustomFeeInfo] = [] } =
    usePromiseResult(async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      if (!account) return;

      return Promise.all([
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceGas.getCustomFeeInfo({ networkId }),
      ]);
    }, [accountId, networkId]);

  const { result, run, setResult, setStopPolling } = usePromiseResult(
    async () => {
      const staleResult = {
        r: undefined,
        e: undefined,
        m: undefined,
      };

      if (!unsignedTxs || unsignedTxs.length === 0) {
        return staleResult;
      }

      feeRequestIdRef.current += 1;
      const requestId = feeRequestIdRef.current;
      const requestTxUuid = unsignedTxs[0]?.uuid;
      const getStaleResult = () =>
        requestId !== feeRequestIdRef.current ||
        requestTxUuid !== currentTxUuidRef.current
          ? staleResult
          : undefined;

      try {
        await backgroundApiProxy.serviceGas.abortEstimateFee();

        if (getStaleResult()) {
          return staleResult;
        }

        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
          errMessage: '',
          discountPercent: 0,
        });

        const presetMultiTxsFee =
          useFeeInTx && !feeInfoEditable
            ? buildPresetMultiTxsFee(unsignedTxs)
            : undefined;

        if (presetMultiTxsFee) {
          const { estimateFeeParams: e } =
            await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              accountId,
              networkId,
              encodedTx: unsignedTxs[0].encodedTx,
            });
          if (getStaleResult()) {
            return staleResult;
          }

          updateEffectiveFeePayer('user');
          resetGasAccountUiState();
          resetMegafuelEligible();
          updateGasAccountUiState({ payer: 'user' });
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          updateTxFeeInfoInit(true);
          updateTxAdvancedSettings({ dataChanged: false });
          return {
            r: undefined,
            e,
            m: presetMultiTxsFee,
          };
        }

        if (isMultiTxs) {
          const vs = await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
          if (getStaleResult()) {
            return staleResult;
          }
          if (vs?.supportBatchEstimateFee?.[networkId]) {
            try {
              const encodedTxList = unsignedTxs.map((tx) => tx.encodedTx);
              const multiTxsFeeResult =
                await backgroundApiProxy.serviceGas.batchEstimateFee({
                  accountId,
                  networkId,
                  encodedTxs: encodedTxList,
                });
              if (getStaleResult()) {
                return staleResult;
              }
              updateSendFeeStatus({
                status: ESendFeeStatus.Success,
                errMessage: '',
              });
              updateTxFeeInfoInit(true);
              return {
                r: undefined,
                e: undefined,
                m: multiTxsFeeResult,
              };
            } catch (e) {
              console.error(e);
              // fallback to single tx estimate fee
            }
          }
        }

        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            networkId,
            accountId,
          });
        if (getStaleResult()) {
          return staleResult;
        }

        const { encodedTx, estimateFeeParams: e } =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            accountId,
            networkId,
            encodedTx: unsignedTxs[0].encodedTx,
          });
        if (getStaleResult()) {
          return staleResult;
        }

        if (isSingleTxWithFeesInfo) {
          const r = unsignedTxs[0].feesInfo;
          if (getStaleResult()) {
            return staleResult;
          }
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          updateTxFeeInfoInit(true);
          updateTxAdvancedSettings({ dataChanged: false });
          return {
            r,
            e,
            m: undefined,
          };
        }

        if (
          (isLastSwapTxWithFeeInfo || isSecondApproveTxWithFeeInfo) &&
          unsignedTxs[0].feeInfo
        ) {
          const r = unsignedTxs[0].feeInfo;
          if (getStaleResult()) {
            return staleResult;
          }
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          updateTxFeeInfoInit(true);
          updateTxAdvancedSettings({ dataChanged: false });
          return {
            r: {
              ...r,
              gas: r.gas ? [r.gas] : undefined,
              gasEIP1559: r.gasEIP1559 ? [r.gasEIP1559] : undefined,
              feeUTXO: r.feeUTXO ? [r.feeUTXO] : undefined,
              feeTron: r.feeTron ? [r.feeTron] : undefined,
              feeSol: r.feeSol ? [r.feeSol] : undefined,
              feeCkb: r.feeCkb ? [r.feeCkb] : undefined,
              feeAlgo: r.feeAlgo ? [r.feeAlgo] : undefined,
              feeDot: r.feeDot ? [r.feeDot] : undefined,
              feeBudget: r.feeBudget ? [r.feeBudget] : undefined,
              feeNeoN3: r.feeNeoN3 ? [r.feeNeoN3] : undefined,
            },
            e,
          };
        }

        let lockedUserNonceValue: number | undefined;
        if (txAdvancedSettings.nonce) {
          lockedUserNonceValue = Number(txAdvancedSettings.nonce);
        } else if (typeof unsignedTxs[0].nonce === 'number') {
          lockedUserNonceValue = unsignedTxs[0].nonce;
        } else if (vaultSettings?.nonceRequired) {
          // Submit resolves an unset nonce via `serviceSend.getNextNonce`
          // before broadcast. The backend binds sponsor quotes to this
          // locked nonce, so estimate must mirror the same resolution —
          // otherwise the quote drifts against the broadcast nonce
          // (typically for users with local pending txs, where
          // `max(pending+1, chain)` differs from the chain nonce the
          // backend defaults to) and triggers a 40209 NONCE_CHANGED
          // refresh loop.
          try {
            lockedUserNonceValue =
              await backgroundApiProxy.serviceSend.getNextNonce({
                accountId,
                networkId,
                accountAddress,
              });
          } catch (nonceErr) {
            // Degrade to the pre-fix behavior for this attempt; a
            // downstream 40209 would still route through the Refresh
            // strategy, so the flow stays recoverable.
            console.warn(
              '[GasAccount] pre-estimate nonce lock failed',
              nonceErr,
            );
            lockedUserNonceValue = undefined;
          }
          if (getStaleResult()) {
            return staleResult;
          }
        }
        const lockedUserNonce = Number.isFinite(lockedUserNonceValue)
          ? lockedUserNonceValue
          : undefined;

        const r = await backgroundApiProxy.serviceGas.estimateFee({
          accountId,
          networkId,
          encodedTx,
          accountAddress,
          transfersInfo: unsignedTxs[0].transfersInfo,
          lockedUserNonce,
          gasAccountEnabled: !gasAccountTemporarilyDisabled,
          scenario: gasAccountScenario,
        });
        // L3 scenario gate telemetry: surface frontend contract bugs. Both
        // reasons indicate a client-side mismatch with the backend enum; log
        // to console so it shows up in dev/staging. Backend already records
        // `admission_*` events for this, so we don't double-report here.
        // `scenario_disabled_*` is a policy outcome and stays silent per
        // product decision.
        if (
          r.gasAccountScenarioReason === 'scenario_missing' ||
          r.gasAccountScenarioReason === 'scenario_unknown'
        ) {
          console.error(
            '[GasAccount] scenario gate rejected request',
            r.gasAccountScenarioReason,
            { scenario: gasAccountScenario, networkId },
          );
        }
        if (getStaleResult()) {
          return staleResult;
        }

        const customRpcInfo =
          r.megafuelEligible || r.gasAccountEligible || r.payer === 'gasAccount'
            ? await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
                networkId,
              )
            : undefined;
        if (getStaleResult()) {
          return staleResult;
        }

        const isCustomRpcEnabled = !!(
          customRpcInfo?.rpc && customRpcInfo?.enabled
        );
        // Multi-tx flows fall through to this single-tx estimate path when
        // `batchEstimateFee` is unavailable or fails. The single-tx estimate
        // can return sponsor eligibility (gasAccount / megafuel) for the
        // first tx, but `ServiceSend.batchSignAndSendTransaction` strips
        // `gasAccountUiState` for any batch (a quote is bound to one user tx
        // via payloadHash + locked nonce). Surfacing sponsor UI here would
        // show "0 network fee" / sponsor badge while the actual broadcast
        // falls back to user-paid. Treat batches like sponsor is disabled.
        const sponsorDisabledForBatch = isMultiTxs;
        // `gasAccountTemporarilyDisabled` narrows only the gas-account path.
        // Megafuel is an independent sponsor mechanism and should still be
        // honored when the server indicates `payer='megafuel'` after a
        // gas-account fallback. Custom RPC and multi-tx batches still force
        // user-paid for all sponsors (see the block comment above).
        const serverPayer: IGasPayer = r.payer ?? 'user';
        const nextEffectiveFeePayer: IGasPayer =
          isCustomRpcEnabled ||
          sponsorDisabledForBatch ||
          (gasAccountTemporarilyDisabled && serverPayer === 'gasAccount')
            ? 'user'
            : serverPayer;
        updateEffectiveFeePayer(nextEffectiveFeePayer);

        if (r.megafuelEligible && !sponsorDisabledForBatch) {
          // if custom rpc is enabled, disable megafuel eligible
          if (isCustomRpcEnabled) {
            r.megafuelEligible = undefined;
            r.gas = r.gas?.map((gas) => ({
              ...gas,
              gasPrice: gas.originalGasPrice ?? gas.gasPrice,
            }));
            updateMegafuelEligible({
              sponsorable: false,
              sponsorName: '',
            });
          } else {
            updateMegafuelEligible(r.megafuelEligible);
          }
        } else {
          if (sponsorDisabledForBatch) {
            r.megafuelEligible = undefined;
            r.gas = r.gas?.map((gas) => ({
              ...gas,
              gasPrice: gas.originalGasPrice ?? gas.gasPrice,
            }));
          }
          resetMegafuelEligible();
        }

        if (
          isCustomRpcEnabled ||
          gasAccountTemporarilyDisabled ||
          sponsorDisabledForBatch
        ) {
          resetGasAccountUiState();
          if (gasAccountTemporarilyDisabled || sponsorDisabledForBatch) {
            // The default state already flags `selectedPayer='user'`,
            // `gasAccountEligible=false`, `idempotencyKey=''`; only the
            // explicit `payer='user'` is worth setting so downstream
            // consumers see a concrete value instead of `undefined`.
            updateGasAccountUiState({ payer: 'user' });
          }
        } else if (r.gasAccountEligible && r.gasAccountQuote) {
          resetGasAccountTemporarilyDisabled();
          const nextSelectedPayer =
            r.megafuelEligible?.sponsorable || r.payer !== 'gasAccount'
              ? 'user'
              : 'gasAccount';

          updateGasAccountUiState({
            payer: r.payer,
            gasAccountEligible: true,
            gasAccountQuote: r.gasAccountQuote,
            selectedPayer: nextSelectedPayer,
            lockedUserNonce,
            idempotencyKey:
              nextSelectedPayer === 'gasAccount'
                ? buildGasAccountIdempotencyKey(r.gasAccountQuote.quoteId)
                : '',
            gasAccountScenarioReason: r.gasAccountScenarioReason,
          });
        } else {
          resetGasAccountUiState();
          // L3 reason is observational: record it so downstream consumers
          // (and Grafana-equivalent telemetry) can distinguish policy gate
          // from transient chain failure. Do NOT set
          // `gasAccountTemporarilyDisabled` — scenario gate is not a
          // fallback-worthy condition, retrying won't flip it.
          if (r.gasAccountScenarioReason) {
            updateGasAccountUiState({
              payer: 'user',
              gasAccountScenarioReason: r.gasAccountScenarioReason,
            });
          }
        }

        // if gasEIP1559 returns 5 gas level, then pick the 1st, 3rd and 5th as default gas level
        // these five levels are also provided as predictions on the custom fee page for users to choose
        if (r.gasEIP1559 && r.gasEIP1559.length === 5) {
          r.gasEIP1559 = [r.gasEIP1559[0], r.gasEIP1559[2], r.gasEIP1559[4]];
        } else if (r.gasEIP1559) {
          r.gasEIP1559 = r.gasEIP1559.slice(0, 3);
        }

        // update tron resource rental fee info
        if (r.feeTron && r.feeTron[0]) {
          if (r.feeTron[0].createOrderParams) {
            const {
              createOrderParams,
              saveTRX,
              info,
              payWithUSDT,
              balances,
              tokenPrices,
            } = r.feeTron[0];

            const tokenAddress = network?.isTestnet
              ? tronTokenAddressTestnet[info.payCoinCode]
              : tronTokenAddressMainnet[info.payCoinCode];

            updateTronResourceRentalInfo({
              isResourceRentalNeeded: true,
              isResourceRentalEnabled: tronRentalUpdated.current
                ? undefined
                : true,
              payType: payWithUSDT
                ? ETronResourceRentalPayType.Token
                : ETronResourceRentalPayType.Native,
              payTokenInfo: {
                symbol: info?.payCoinCode ?? '',
                price: tokenPrices[tokenAddress] ?? '0',
                trxRatio: info?.ratio ?? '0',
                exchangeFee: info?.exchangeFee ?? 0,
                payTxFeeAmount: new BigNumber(info?.payCoinAmt ?? 0)
                  .minus(info?.purchaseTRXFee ?? 0)
                  .toFixed(),
                payPurchaseTrxAmount: new BigNumber(
                  info?.purchaseTRXFee ?? 0,
                ).toFixed(),
                extraTrxNum: info?.extraTrxNum ?? 0,
                totalAmount: new BigNumber(info?.payCoinAmt ?? 0).toFixed(),
              },
              saveTRX,
              createOrderParams,
              resourcePrice: {
                price: info.orderPrice,
                minutes: info.pledgeMinute,
              },
            });

            tronRentalUpdated.current = true;

            if (payWithUSDT) {
              // Preserve the enabled state derived from resource rental config.
              updatePayWithTokenInfo({
                address: tokenAddress,
                balance: balances[tokenAddress] ?? '0',
                symbol: info.payCoinCode,
              });
            } else {
              resetPayWithTokenInfo();
            }
          } else {
            resetTronResourceRentalInfo();
            resetPayWithTokenInfo();
            tronRentalUpdated.current = false;
          }
        } else {
          resetTronResourceRentalInfo();
          resetPayWithTokenInfo();
          tronRentalUpdated.current = false;
        }

        updateSendFeeStatus({
          status: ESendFeeStatus.Success,
          errMessage: '',
        });
        updateTxFeeInfoInit(true);
        updateTxAdvancedSettings({ dataChanged: false });
        return {
          r,
          e,
          m: undefined,
        };
      } catch (e) {
        if (getStaleResult()) {
          return staleResult;
        }

        // Mirror the submit-flow strategy table (see
        // `handleGasAccountSubmitError` in TxConfirmActions). Estimate polls on
        // an interval with `gasAccountEnabled: !gasAccountTemporarilyDisabled`,
        // so a sponsor-side failure (e.g. 40_218 SPONSOR_UNAVAILABLE) that
        // isn't classified here would loop: every tick re-asks for a sponsor
        // and gets the same error. Classifying the error and flipping
        // `gasAccountTemporarilyDisabled` forces the next tick onto the
        // user-paid path.
        const gasAccountCode = getGasAccountErrorCode(e);
        const gasAccountEntry = getGasAccountErrorEntry(gasAccountCode);
        if (
          gasAccountEntry &&
          !gasAccountTemporarilyDisabled &&
          (gasAccountEntry.strategy === EGasAccountErrorStrategy.Fallback ||
            gasAccountEntry.strategy === EGasAccountErrorStrategy.Hint)
        ) {
          if (e) {
            (e as IOneKeyError).autoToast = false;
          }
          updateEffectiveFeePayer('user');
          updateGasAccountTemporarilyDisabled(true);
          resetGasAccountUiState();
          updateGasAccountUiState({ payer: 'user' });
          resetMegafuelEligible();
          updateTxFeeInfoInit(false);
          updateSendFeeStatus({
            status: ESendFeeStatus.Loading,
            errMessage: '',
            discountPercent: 0,
          });
          if (!gasAccountEntry.suppressToast) {
            Toast.warning({
              title: intl.formatMessage({ id: gasAccountEntry.messageKey }),
            });
          }
          appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
          return staleResult;
        }
        if (
          gasAccountEntry &&
          gasAccountEntry.strategy === EGasAccountErrorStrategy.Refresh
        ) {
          if (e) {
            (e as IOneKeyError).autoToast = false;
          }
          resetGasAccountUiState();
          resetMegafuelEligible();
          updateTxFeeInfoInit(false);
          updateSendFeeStatus({
            status: ESendFeeStatus.Loading,
            errMessage: '',
            discountPercent: 0,
          });
          if (!gasAccountEntry.suppressToast) {
            Toast.warning({
              title: intl.formatMessage({ id: gasAccountEntry.messageKey }),
            });
          }
          appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
          return staleResult;
        }

        const apiError = e as IOneKeyError;
        // Server-driven stop: when the backend marks an error with
        // `stopPolling: true` (e.g. allowance shortage, expired swap quote),
        // retrying with the same input will keep failing. Pause future ticks
        // so the message stays visible without spamming the endpoint. Polling
        // auto-resumes when deps (unsignedTxs/accountId/...) change.
        if (apiError?.data?.stopPolling === true) {
          // Suppress the global error toast — the inline fee error already
          // carries the same message and stays visible after polling stops,
          // so a transient toast on top would be redundant. Mirrors the
          // sponsor-fallback branches above.
          apiError.autoToast = false;
          setStopPolling(true);
        }

        updateTxFeeInfoInit(true);
        updateTxAdvancedSettings({ dataChanged: false });
        updateSendFeeStatus({
          status: ESendFeeStatus.Error,
          // Inner JSON-RPC error first so `execution reverted: ...` from the
          // upstream node survives the OneKey API response wrapper — the outer
          // `translatedMessage/message` is generic server-side packaging text
          // and would otherwise hide the real RPC failure reason from the user.
          errMessage:
            (e as { data: { data: IOneKeyRpcError } }).data?.data?.res?.error
              ?.message ??
            apiError?.data?.translatedMessage ??
            apiError?.data?.message ??
            apiError?.message ??
            (e as Error).message ??
            e,
        });
        // The previous estimate may have populated sponsor state (badge, quote).
        // Clear it together with the payer so a stale "free" UI never survives
        // a failed re-estimate and misleads the user or leaks an expired quote
        // into submit.
        updateEffectiveFeePayer('user');
        resetGasAccountUiState();
        resetMegafuelEligible();
      }
    },
    [
      accountId,
      isLastSwapTxWithFeeInfo,
      isMultiTxs,
      isSecondApproveTxWithFeeInfo,
      isSingleTxWithFeesInfo,
      feeInfoEditable,
      network?.isTestnet,
      networkId,
      unsignedTxs,
      useFeeInTx,
      gasAccountTemporarilyDisabled,
      resetGasAccountTemporarilyDisabled,
      updateGasAccountTemporarilyDisabled,
      resetGasAccountUiState,
      resetMegafuelEligible,
      resetPayWithTokenInfo,
      resetTronResourceRentalInfo,
      updateEffectiveFeePayer,
      updateGasAccountUiState,
      updateMegafuelEligible,
      updatePayWithTokenInfo,
      updateSendFeeStatus,
      updateTronResourceRentalInfo,
      updateTxAdvancedSettings,
      updateTxFeeInfoInit,
      txAdvancedSettings.nonce,
      vaultSettings?.nonceRequired,
      gasAccountScenario,
      intl,
    ],
    {
      watchLoading: true,
      pollingInterval: vaultSettings?.estimatedFeePollingInterval
        ? timerUtils.getTimeDurationMs({
            seconds: vaultSettings?.estimatedFeePollingInterval,
          })
        : undefined,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused &&
        sendSelectedFee.feeType !== EFeeType.Custom &&
        !sendTxStatus.isSubmitting,
    },
  );

  const { r: txFee, e: estimateFeeParams, m: multiTxsFee } = result ?? {};

  const txFeeCommon = txFee?.common ?? multiTxsFee?.common;
  const gasAccountFeeNative = useMemo(() => {
    if (!network) {
      return '0';
    }

    return chainValueUtils.convertChainValueToAmount({
      value: gasAccountMaxFee || '0',
      network,
    });
  }, [gasAccountMaxFee, network]);
  const gasAccountFeeFiat = useMemo(
    () =>
      new BigNumber(gasAccountFeeNative || 0).times(
        txFeeCommon?.nativeTokenPrice ?? 0,
      ),
    [gasAccountFeeNative, txFeeCommon?.nativeTokenPrice],
  );
  const isGasAccountFree = isGasAccountSponsored;

  const openFeeEditorEnabled =
    !isLastSwapTxWithFeeInfo &&
    !isSecondApproveTxWithFeeInfo &&
    (!!vaultSettings?.editFeeEnabled || !!vaultSettings?.checkFeeDetailEnabled);

  const feeSelectorItems: IFeeSelectorItem[] = useMemo(() => {
    const items = [];
    if (txFee) {
      const feeLength =
        txFee.gasEIP1559?.length ||
        txFee.gas?.length ||
        txFee.feeUTXO?.length ||
        txFee.feeTron?.length ||
        txFee.feeSol?.length ||
        txFee.feeCkb?.length ||
        txFee.feeAlgo?.length ||
        txFee.feeDot?.length ||
        txFee.feeBudget?.length ||
        txFee.feeNeoN3?.length ||
        0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: txFee?.common,
          gas: txFee.gas?.[i],
          gasEIP1559: txFee.gasEIP1559?.[i],
          feeUTXO: txFee.feeUTXO?.[i],
          feeTron: txFee.feeTron?.[i],
          feeSol: txFee.feeSol?.[i],
          feeCkb: txFee.feeCkb?.[i],
          feeAlgo: txFee.feeAlgo?.[i],
          feeDot: txFee.feeDot?.[i],
          feeBudget: txFee.feeBudget?.[i],
          feeNeoN3: txFee.feeNeoN3?.[i],
        };

        const useDappFeeAndNotEditFee =
          vaultSettings?.editFeeEnabled && !feeInfoEditable && useFeeInTx;
        if (useDappFeeAndNotEditFee && network) {
          const { tip } = unsignedTxs[0].encodedTx as IEncodedTxDot;
          const feeDecimals = feeInfo.common?.feeDecimals;
          if (feeInfo.feeDot && tip && typeof feeDecimals === 'number') {
            // Only the fee display is affected on sendConfirm page
            feeInfo.feeDot = {
              ...feeInfo.feeDot,
              extraTipInDot: new BigNumber(tip)
                .shiftedBy(-feeDecimals)
                .toFixed(),
            };
          }

          if (
            network &&
            network.impl === IMPL_APTOS &&
            unsignedTxs.length > 0
          ) {
            const { gas_unit_price: aptosGasPrice } = unsignedTxs[0]
              .encodedTx as IEncodedTxAptos;
            // use dApp fee
            if (aptosGasPrice) {
              const gasPrice = chainValueUtils.convertChainValueToGwei({
                value: aptosGasPrice,
                network,
              });

              feeInfo.gas = {
                ...feeInfo.gas,
                gasPrice,
                gasLimit: feeInfo.gas?.gasLimit ?? '1',
              };
            }
          }
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({
              feeType: EFeeType.Standard,
              presetIndex: i,
              isSinglePreset,
            }),
          }),
          icon: getFeeIcon({
            feeType: EFeeType.Standard,
            presetIndex: i,
            isSinglePreset,
          }),
          value: i,
          feeInfo,
          type: EFeeType.Standard,
        });
      }

      // only have base fee fallback
      if (items.length === 0) {
        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Standard, presetIndex: 0 }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Standard, presetIndex: 0 }),
          value: 1,
          feeInfo: {
            common: txFee.common,
          },
          type: EFeeType.Standard,
        });
      }

      updateIsSinglePreset(items.length === 1);

      if (vaultSettings?.editFeeEnabled && feeInfoEditable && !isMultiTxs) {
        let customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.gas && !isEmpty(txFee.gas)) {
          customFeeInfo.gas = {
            ...(txFee.gas[sendSelectedFee.presetIndex] ?? txFee.gas[0]),
            ...customFee?.gas,
          };
        }

        if (txFee.gasEIP1559 && !isEmpty(txFee.gasEIP1559)) {
          customFeeInfo.gasEIP1559 = {
            ...(txFee.gasEIP1559[sendSelectedFee.presetIndex] ??
              txFee.gasEIP1559[0]),
            ...customFee?.gasEIP1559,
          };
        }

        if (txFee.feeUTXO && !isEmpty(txFee.feeUTXO)) {
          customFeeInfo.feeUTXO = {
            ...(txFee.feeUTXO[sendSelectedFee.presetIndex] ?? txFee.feeUTXO[0]),
            ...customFee?.feeUTXO,
          };
        }

        if (txFee.feeSol && !isEmpty(txFee.feeSol)) {
          customFeeInfo.feeSol = {
            ...(txFee.feeSol[sendSelectedFee.presetIndex] ?? txFee.feeSol[0]),
            ...customFee?.feeSol,
          };
        }

        if (txFee.feeCkb && !isEmpty(txFee.feeCkb)) {
          customFeeInfo.feeCkb = {
            ...(txFee.feeCkb[sendSelectedFee.presetIndex] ?? txFee.feeCkb[0]),
            ...customFee?.feeCkb,
          };
        }

        if (txFee.feeAlgo && !isEmpty(txFee.feeAlgo)) {
          customFeeInfo.feeAlgo = {
            ...(txFee.feeAlgo[sendSelectedFee.presetIndex] ?? txFee.feeAlgo[0]),
            ...(customFee?.feeAlgo ?? {
              minFee: ALGO_TX_MIN_FEE,
              baseFee: ALGO_TX_MIN_FEE,
            }),
          };
        }

        if (txFee.feeDot && !isEmpty(txFee.feeDot)) {
          customFeeInfo.feeDot = {
            ...(txFee.feeDot[sendSelectedFee.presetIndex] ?? txFee.feeDot[0]),
            ...(customFee?.feeDot ?? { extraTipInDot: '0' }),
          };
        }

        if (txFee.feeBudget && !isEmpty(txFee.feeBudget)) {
          customFeeInfo.feeBudget = {
            ...(txFee.feeBudget[sendSelectedFee.presetIndex] ??
              txFee.feeBudget[0]),
            ...customFee?.feeBudget,
          };
        }

        if (txFee.feeNeoN3 && !isEmpty(txFee.feeNeoN3)) {
          customFeeInfo.feeNeoN3 = {
            ...(txFee.feeNeoN3[sendSelectedFee.presetIndex] ??
              txFee.feeNeoN3[0]),
            ...customFee?.feeNeoN3,
          };
        }

        if (network && !feeInTxUpdated.current) {
          let originalFeeChanged = false;

          const defaultCustomFeeEnabled =
            defaultCustomFeeInfo?.enabled && defaultCustomFeeInfo?.feeInfo;

          // Saved custom fee has the highest priority
          if (defaultCustomFeeEnabled) {
            customFeeInfo = {
              ...customFeeInfo,
              ...defaultCustomFeeInfo.feeInfo,

              // for gas & gasEIP1559, always use latest gasLimit
              gas: customFeeInfo.gas
                ? {
                    ...customFeeInfo.gas,
                    gasPrice: defaultCustomFeeInfo.feeInfo.gas?.gasPrice ?? '',
                  }
                : undefined,
              gasEIP1559: customFeeInfo.gasEIP1559
                ? {
                    ...customFeeInfo.gasEIP1559,
                    baseFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.baseFeePerGas ??
                      customFeeInfo.gasEIP1559?.baseFeePerGas ??
                      '',
                    maxFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.maxFeePerGas ??
                      customFeeInfo.gasEIP1559?.maxFeePerGas ??
                      '',
                    maxPriorityFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559
                        ?.maxPriorityFeePerGas ??
                      customFeeInfo.gasEIP1559?.maxPriorityFeePerGas ??
                      '',
                    confidence:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.confidence ??
                      customFeeInfo.gasEIP1559?.confidence ??
                      0,
                    gasPrice:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.gasPrice ??
                      customFeeInfo.gasEIP1559?.gasPrice ??
                      '',
                  }
                : undefined,

              feeBudget: customFeeInfo.feeBudget
                ? {
                    ...customFeeInfo.feeBudget,
                    gasPrice:
                      defaultCustomFeeInfo.feeInfo.feeBudget?.gasPrice ??
                      customFeeInfo.feeBudget?.gasPrice ??
                      '',
                  }
                : undefined,
            };

            originalFeeChanged = true;
          } else if (useFeeInTx) {
            const selectedFeeResult = calculateTotalFeeRange({
              feeInfo: customFeeInfo,
              txSize: unsignedTxs?.[0]?.txSize ?? 0,
              estimateFeeParams,
            });

            const {
              gas,
              gasLimit,
              gasPrice,
              maxFeePerGas,
              maxPriorityFeePerGas,
            } = unsignedTxs[0].encodedTx as IEncodedTxEvm;

            const limit = gasLimit || gas;
            if (
              maxFeePerGas &&
              maxPriorityFeePerGas &&
              customFeeInfo.gasEIP1559
            ) {
              customFeeInfo.gasEIP1559 = {
                ...customFeeInfo.gasEIP1559,
                maxFeePerGas: chainValueUtils.convertChainValueToGwei({
                  value: maxFeePerGas,
                  network,
                }),
                maxPriorityFeePerGas: chainValueUtils.convertChainValueToGwei({
                  value: maxPriorityFeePerGas,
                  network,
                }),
                gasLimit: limit ?? customFeeInfo.gasEIP1559?.gasLimit,
                gasLimitForDisplay:
                  limit ?? customFeeInfo.gasEIP1559?.gasLimitForDisplay,
              };
              originalFeeChanged = true;
            } else if (gasPrice && customFeeInfo.gas) {
              customFeeInfo.gas = {
                ...customFeeInfo.gas,
                gasPrice: chainValueUtils.convertChainValueToGwei({
                  value: gasPrice,
                  network,
                }),
                gasLimit: limit ?? customFeeInfo.gas?.gasLimit,
                gasLimitForDisplay:
                  limit ?? customFeeInfo.gas?.gasLimitForDisplay,
              };
              originalFeeChanged = true;
            } else if (limit) {
              if (customFeeInfo.gasEIP1559) {
                customFeeInfo.gasEIP1559 = {
                  ...customFeeInfo.gasEIP1559,
                  gasLimit: limit,
                  gasLimitForDisplay: limit,
                };
                originalFeeChanged = true;
              }
              if (customFeeInfo.gas) {
                customFeeInfo.gas = {
                  ...customFeeInfo.gas,
                  gasLimit: limit,
                  gasLimitForDisplay: limit,
                };
                originalFeeChanged = true;
              }
            }

            const dappFeeResult = calculateTotalFeeRange({
              feeInfo: customFeeInfo,
              txSize: unsignedTxs?.[0]?.txSize ?? 0,
              estimateFeeParams,
            });

            console.log('selectedFeeResult >>>>>>>>>>>>>', selectedFeeResult);
            console.log('dappFeeResult >>>>>>>>>>>>>', dappFeeResult);

            if (new BigNumber(dappFeeResult.max).gte(selectedFeeResult.max)) {
              originalFeeChanged = false;
            }
          }

          if (originalFeeChanged) {
            updateSendSelectedFee({
              feeType: EFeeType.Custom,
              presetIndex: 0,
              source:
                useFeeInTx && !defaultCustomFeeEnabled ? 'dapp' : 'wallet',
            });
            updateCustomFee(customFeeInfo);
          }

          feeInTxUpdated.current = true;
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Custom }),
          value: items.length,
          feeInfo: customFeeInfo,
          type: EFeeType.Custom,
        });
      }

      if (
        vaultSettings?.editFeeEnabled &&
        useFeeInTx &&
        !feeInfoEditable &&
        !isMultiTxs
      ) {
        const customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.feeUTXO && !isEmpty(txFee.feeUTXO)) {
          customFeeInfo.feeUTXO = {
            ...txFee.feeUTXO[sendSelectedFee.presetIndex],
            ...customFee?.feeUTXO,
          };
        }

        if (!feeInTxUpdated.current) {
          const { fee } = unsignedTxs[0].encodedTx as IEncodedTxBtc;

          if (txFee.feeUTXO && fee) {
            customFeeInfo.feeUTXO = {
              feeValue: fee,
            };

            updateSendSelectedFee({
              feeType: EFeeType.Custom,
              presetIndex: 0,
              source: 'dapp',
            });

            updateCustomFee(customFeeInfo);
          }

          feeInTxUpdated.current = true;
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Custom }),
          value: items.length,
          feeInfo: customFeeInfo,
          type: EFeeType.Custom,
        });
      }

      return items;
    }

    return [];
  }, [
    txFee,
    updateIsSinglePreset,
    vaultSettings?.editFeeEnabled,
    feeInfoEditable,
    isMultiTxs,
    useFeeInTx,
    network,
    intl,
    isSinglePreset,
    unsignedTxs,
    sendSelectedFee.presetIndex,
    customFee?.gas,
    customFee?.gasEIP1559,
    customFee?.feeUTXO,
    customFee?.feeSol,
    customFee?.feeCkb,
    customFee?.feeAlgo,
    customFee?.feeDot,
    customFee?.feeBudget,
    customFee?.feeNeoN3,
    defaultCustomFeeInfo?.enabled,
    defaultCustomFeeInfo?.feeInfo,
    estimateFeeParams,
    updateSendSelectedFee,
    updateCustomFee,
  ]);

  const multiTxsFeeSelectorItems: IMultiTxsFeeSelectorItem[] = useMemo(() => {
    const items = [];

    if (multiTxsFee) {
      const feeItem = multiTxsFee.txFees[0];
      const feeLength = feeItem.gasEIP1559?.length || feeItem.gas?.length || 0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfos: IFeeInfoUnit[] = multiTxsFee.txFees.map((fee) => ({
          common: multiTxsFee.common,
          gas: fee.gas?.[i],
          gasEIP1559: fee.gasEIP1559?.[i],
        }));

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({
              feeType: EFeeType.Standard,
              presetIndex: i,
              isSinglePreset,
            }),
          }),
          icon: getFeeIcon({
            feeType: EFeeType.Standard,
            presetIndex: i,
            isSinglePreset,
          }),
          value: i,
          feeInfos,
          type: EFeeType.Standard,
        });
      }

      updateIsSinglePreset(items.length === 1);

      return items;
    }

    return [];
  }, [multiTxsFee, updateIsSinglePreset, intl, isSinglePreset]);

  const { selectedFee } = useMemo(() => {
    let selectedFeeInfos: IFeeInfoUnit[] = [];

    if (isEmpty(feeSelectorItems) && isEmpty(multiTxsFeeSelectorItems))
      return {};

    if (!isEmpty(multiTxsFeeSelectorItems)) {
      if (sendSelectedFee.feeType === EFeeType.Custom) {
        selectedFeeInfos =
          multiTxsFeeSelectorItems[multiTxsFeeSelectorItems.length - 1]
            .feeInfos;
      } else {
        let feeSelectorItem =
          multiTxsFeeSelectorItems[sendSelectedFee.presetIndex] ??
          multiTxsFeeSelectorItems[0];
        if (feeSelectorItem.type === EFeeType.Custom) {
          feeSelectorItem = multiTxsFeeSelectorItems[0];
        }
        selectedFeeInfos = feeSelectorItem.feeInfos;
      }
    } else if (sendSelectedFee.feeType === EFeeType.Custom) {
      selectedFeeInfos = [
        feeSelectorItems[feeSelectorItems.length - 1].feeInfo,
      ];
    } else {
      let feeSelectorItem =
        feeSelectorItems[sendSelectedFee.presetIndex] ?? feeSelectorItems[0];
      if (feeSelectorItem.type === EFeeType.Custom) {
        feeSelectorItem = feeSelectorItems[0];
      }
      selectedFeeInfos = [feeSelectorItem.feeInfo];
    }

    const feeInfos: {
      feeInfo: IFeeInfoUnit;
      total: string;
      totalMin: string;
      totalNative: string;
      totalNativeMin: string;
      totalFiat: string;
      totalFiatMin: string;
      totalNativeForDisplay: string;
      totalFiatForDisplay: string;
      totalNativeMinForDisplay: string;
      totalFiatMinForDisplay: string;
      originalTotalNative?: string;
      originalTotalFiat?: string;
    }[] = [];

    let baseGasLimit =
      selectedFeeInfos[0].gas?.gasLimit ??
      selectedFeeInfos[0].gasEIP1559?.gasLimit;

    let total = new BigNumber(0);
    let totalMin = new BigNumber(0);
    let totalNative = new BigNumber(0);
    let totalNativeMin = new BigNumber(0);
    let totalFiat = new BigNumber(0);
    let totalFiatMin = new BigNumber(0);
    let totalNativeForDisplay = new BigNumber(0);
    let totalNativeMinForDisplay = new BigNumber(0);
    let totalFiatForDisplay = new BigNumber(0);
    let totalFiatMinForDisplay = new BigNumber(0);
    let originalTotalNative: BigNumber | undefined;
    let originalTotalFiat: BigNumber | undefined;

    for (let i = 0; i < unsignedTxs.length; i += 1) {
      const selectedFeeInfo = selectedFeeInfos[i];

      const unsignedTx = unsignedTxs[i];
      let specialGasLimit: string | undefined;

      // build second approve tx fee info base on first approve fee info
      if (
        !selectedFeeInfo &&
        ((isMultiTxs && unsignedTx.approveInfo && i !== 0) ||
          isSecondApproveTxWithFeeInfo)
      ) {
        specialGasLimit = new BigNumber(baseGasLimit ?? 0)
          .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE)
          .toFixed();
        baseGasLimit = specialGasLimit;
      }
      // build swap tx fee info base on first approve fee info
      else if (
        (isLastSwapTxWithFeeInfo || !selectedFeeInfo) &&
        (isLastSwapTxWithFeeInfo || isMultiTxs) &&
        unsignedTx.swapInfo &&
        (selectedFeeInfos[0].gas || selectedFeeInfos[0].gasEIP1559)
      ) {
        const swapInfo = unsignedTx.swapInfo;
        const internalSwapGasLimit = swapInfo.swapBuildResData.result.gasLimit;
        const internalSwapRoutes = swapInfo.swapBuildResData.result.routesData;

        if (!isNil(internalSwapGasLimit)) {
          specialGasLimit = new BigNumber(internalSwapGasLimit).toFixed();
        } else if (internalSwapRoutes && internalSwapRoutes.length > 0) {
          const allRoutesLength = internalSwapRoutes.reduce(
            (acc, cur) => acc.plus(cur.subRoutes?.flat().length ?? 1),
            new BigNumber(0),
          );
          specialGasLimit = new BigNumber(baseGasLimit ?? 0)
            .times(
              allRoutesLength
                .plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
                .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP),
            )
            .toFixed();
        } else {
          specialGasLimit = new BigNumber(baseGasLimit ?? 0)
            .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
            .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP)
            .toFixed();
        }
      }

      const baseSelectedFeeInfo = selectedFeeInfo ?? selectedFeeInfos[0];

      const txFeeInfo = {
        ...baseSelectedFeeInfo,
        gas: baseSelectedFeeInfo.gas
          ? {
              ...baseSelectedFeeInfo.gas,
              gasLimit: specialGasLimit ?? baseSelectedFeeInfo.gas?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ?? baseSelectedFeeInfo.gas?.gasLimitForDisplay,
            }
          : undefined,
        gasEIP1559: baseSelectedFeeInfo.gasEIP1559
          ? {
              ...baseSelectedFeeInfo.gasEIP1559,
              gasLimit:
                specialGasLimit ?? baseSelectedFeeInfo.gasEIP1559?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ??
                baseSelectedFeeInfo.gasEIP1559?.gasLimitForDisplay,
            }
          : undefined,
      };

      const feeResult = calculateFeeForSend({
        feeInfo: txFeeInfo,
        nativeTokenPrice: txFeeCommon?.nativeTokenPrice ?? 0,
        txSize: unsignedTx.txSize,
        estimateFeeParams,
      });

      total = total.plus(feeResult.total);
      totalMin = totalMin.plus(feeResult.totalMin);
      totalNative = totalNative.plus(feeResult.totalNative);
      totalNativeMin = totalNativeMin.plus(feeResult.totalNativeMin);
      totalFiat = totalFiat.plus(feeResult.totalFiat);
      totalFiatMin = totalFiatMin.plus(feeResult.totalFiatMin);
      totalNativeForDisplay = totalNativeForDisplay.plus(
        feeResult.totalNativeForDisplay,
      );
      totalNativeMinForDisplay = totalNativeMinForDisplay.plus(
        feeResult.totalNativeMinForDisplay,
      );
      totalFiatForDisplay = totalFiatForDisplay.plus(
        feeResult.totalFiatForDisplay,
      );
      totalFiatMinForDisplay = totalFiatMinForDisplay.plus(
        feeResult.totalFiatMinForDisplay,
      );

      if (!isNil(feeResult.originalTotalNative)) {
        originalTotalNative = (originalTotalNative ?? new BigNumber(0)).plus(
          feeResult.originalTotalNative,
        );
      }

      if (!isNil(feeResult.originalTotalFiat)) {
        originalTotalFiat = (originalTotalFiat ?? new BigNumber(0)).plus(
          feeResult.originalTotalFiat,
        );
      }

      feeInfos.push({
        feeInfo: txFeeInfo,
        total: feeResult.total,
        totalMin: feeResult.totalMin,
        totalNative: feeResult.totalNative,
        totalNativeMin: feeResult.totalNativeMin,
        totalNativeMinForDisplay: feeResult.totalNativeMinForDisplay,
        totalFiat: feeResult.totalFiat,
        totalFiatMin: feeResult.totalFiatMin,
        totalFiatMinForDisplay: feeResult.totalFiatMinForDisplay,
        totalNativeForDisplay: feeResult.totalNativeForDisplay,
        totalFiatForDisplay: feeResult.totalFiatForDisplay,
        originalTotalNative: feeResult.originalTotalNative,
        originalTotalFiat: feeResult.originalTotalFiat,
      });
    }

    // Due to the tendency to use higher fee estimates for approve&swap multi-txs to ensure success,
    // we adjust the displayed fee to be closer to the actual on-chain cost for the user
    if (
      isEmpty(multiTxsFeeSelectorItems) &&
      isMultiTxs &&
      unsignedTxs.some((tx) => tx.approveInfo) &&
      unsignedTxs.some((tx) => tx.swapInfo)
    ) {
      totalNativeForDisplay = totalNativeForDisplay.times(
        BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
      );
      totalFiatForDisplay = totalFiatForDisplay.times(
        BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
      );
    }

    return {
      selectedFee: {
        feeInfos,
        total: total.toFixed(),
        totalMin: totalMin.toFixed(),
        totalNative: totalNative.toFixed(),
        totalNativeMin: totalNativeMin.toFixed(),
        totalFiat: totalFiat.toFixed(),
        totalFiatMin: totalFiatMin.toFixed(),
        totalNativeForDisplay: totalNativeForDisplay.toFixed(),
        totalNativeMinForDisplay: totalNativeMinForDisplay.toFixed(),
        totalFiatForDisplay: totalFiatForDisplay.toFixed(),
        totalFiatMinForDisplay: totalFiatMinForDisplay.toFixed(),
        originalTotalNative: originalTotalNative?.toFixed(),
        originalTotalFiat: originalTotalFiat?.toFixed(),
      },
    };
  }, [
    estimateFeeParams,
    feeSelectorItems,
    isLastSwapTxWithFeeInfo,
    isMultiTxs,
    isSecondApproveTxWithFeeInfo,
    multiTxsFeeSelectorItems,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFeeCommon?.nativeTokenPrice,
    unsignedTxs,
  ]);

  const handleApplyFeeInfo = useCallback(
    ({
      feeType,
      presetIndex,
      customFeeInfo,
      source,
    }: {
      feeType: EFeeType;
      presetIndex: number;
      customFeeInfo: IFeeInfoUnit;
      source?: 'dapp' | 'wallet';
    }) => {
      if (feeType === EFeeType.Custom) {
        updateSendSelectedFee({
          feeType: EFeeType.Custom,
          presetIndex: 0,
          source,
        });
        updateCustomFee(customFeeInfo);
      } else {
        updateSendSelectedFee({
          feeType,
          presetIndex,
        });
        void backgroundApiProxy.serviceGas.updateFeePresetIndex({
          networkId,
          presetIndex,
        });
      }
    },
    [networkId, updateCustomFee, updateSendSelectedFee],
  );

  useLayoutEffect(() => {
    if (!currentTxUuid || lastTxUuidRef.current === currentTxUuid) {
      return;
    }

    lastTxUuidRef.current = currentTxUuid;
    feeRequestIdRef.current += 1;
    feeInTxUpdated.current = false;
    tronRentalUpdated.current = false;
    setResult(undefined);
    resetTxFeeState();
    updateSendFeeStatus({
      status: ESendFeeStatus.Loading,
      errMessage: '',
      discountPercent: 0,
    });
    void backgroundApiProxy.serviceGas.abortEstimateFee();
  }, [currentTxUuid, resetTxFeeState, setResult, updateSendFeeStatus]);

  useEffect(() => {
    if (selectedFee && !isEmpty(selectedFee.feeInfos)) {
      updateSendSelectedFeeInfo(selectedFee);
    }
  }, [selectedFee, updateSendSelectedFeeInfo]);

  useEffect(() => {
    if (!isNil(vaultSettings?.defaultFeePresetIndex)) {
      updateSendSelectedFee({
        feeType: EFeeType.Standard,
        presetIndex: vaultSettings?.defaultFeePresetIndex,
        source: 'wallet',
      });
    }
  }, [
    currentTxUuid,
    networkId,
    updateSendSelectedFee,
    vaultSettings?.defaultFeePresetIndex,
  ]);

  useEffect(() => {
    if (!txFeeInfoInit) return;

    if (isGasAccountSelected) {
      // Gas Account sponsorship only covers the network fee, not the
      // principal native amount being transferred or chain-specific extra
      // fees paid from the user's native balance (e.g. Solana SPL token
      // account creation rent). Still validate that the user holds enough
      // native balance for `amountToUpdate + extraFee`, otherwise the
      // top-up alert disappears and Confirm becomes clickable until the
      // submit fails on chain.
      if (nativeTokenInfo.isLoading || !nativeTokenInfo) return;

      const requiredNativeBalance = new BigNumber(
        nativeTokenTransferAmountToUpdate.amountToUpdate ?? 0,
      ).plus(extraFeeInfo.feeNative ?? 0);
      const fillUpNativeBalance = requiredNativeBalance.minus(
        nativeTokenInfo.balance ?? 0,
      );
      const decodedTx = decodedTxs[0];
      let isInsufficientNativeBalance =
        nativeTokenTransferAmountToUpdate.isMaxSend
          ? false
          : requiredNativeBalance.gt(nativeTokenInfo.balance ?? 0);
      if (decodedTx && decodedTx.isPsbt) {
        isInsufficientNativeBalance = false;
      }

      updateSendTxStatus({
        isInsufficientNativeBalance,
        isInsufficientTokenBalance: false,
        fillUpNativeBalance: fillUpNativeBalance
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
        fillUpTokenBalance: '0',
        isBaseOnEstimateMaxFee: false,
        maxFeeNative: '0',
      });
      return;
    }

    if (payWithTokenInfo.enabled) {
      let requiredTokenBalance = new BigNumber(tokenTransferAmount ?? 0);

      if (
        isResourceRentalNeeded &&
        isResourceRentalEnabled &&
        payType === ETronResourceRentalPayType.Token
      ) {
        if (isSwapTrxEnabled) {
          requiredTokenBalance = requiredTokenBalance.plus(
            payTokenInfo?.totalAmount ?? 0,
          );
        } else {
          requiredTokenBalance = requiredTokenBalance.plus(
            payTokenInfo?.payTxFeeAmount ?? 0,
          );
        }
      }

      const isInsufficientTokenBalance = requiredTokenBalance.gt(
        payWithTokenInfo.balance ?? 0,
      );

      const fillUpTokenBalance = requiredTokenBalance.minus(
        payWithTokenInfo.balance ?? 0,
      );

      updateSendTxStatus({
        isInsufficientNativeBalance: false,
        isInsufficientTokenBalance,
        fillUpTokenBalance: fillUpTokenBalance
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
      });
    } else {
      if (nativeTokenInfo.isLoading || !nativeTokenInfo) return;

      let totalFeeNative = selectedFee?.totalNative;

      if (
        isResourceRentalNeeded &&
        isResourceRentalEnabled &&
        payType === ETronResourceRentalPayType.Native
      ) {
        totalFeeNative = payTokenInfo?.totalAmount;
      }

      const requiredNativeBalance = new BigNumber(
        nativeTokenTransferAmountToUpdate.amountToUpdate ?? 0,
      )
        .plus(totalFeeNative ?? 0)
        .plus(extraFeeInfo.feeNative ?? 0);

      const fillUpNativeBalance = requiredNativeBalance.minus(
        nativeTokenInfo.balance ?? 0,
      );

      const decodedTx = decodedTxs[0];

      let isInsufficientNativeBalance =
        nativeTokenTransferAmountToUpdate.isMaxSend
          ? false
          : requiredNativeBalance.gt(nativeTokenInfo.balance ?? 0);

      if (decodedTx && decodedTx.isPsbt) {
        isInsufficientNativeBalance = false;
      }

      updateSendTxStatus({
        isInsufficientTokenBalance: false,
        isInsufficientNativeBalance,
        fillUpNativeBalance: fillUpNativeBalance
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
        isBaseOnEstimateMaxFee:
          selectedFee?.totalNativeMinForDisplay !== totalFeeNative,
        maxFeeNative: new BigNumber(totalFeeNative ?? 0)
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
      });
    }
  }, [
    decodedTxs,
    txFeeInfoInit,
    extraFeeInfo.feeNative,
    isGasAccountSelected,
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    nativeTokenInfo,
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate,
    payTokenInfo?.payTxFeeAmount,
    payTokenInfo?.totalAmount,
    payType,
    payWithTokenInfo.balance,
    payWithTokenInfo.enabled,
    selectedFee,
    tokenTransferAmount,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.TxFeeInfoChanged, {
      feeSelectorItems,
    });
  }, [feeSelectorItems]);

  useEffect(() => {
    const callback = () => {
      // setStopPolling(false) clears any prior server-driven stop AND
      // resurrects the polling chain (the finally-block guard kills it once
      // stopPollingRef flips true). It returns true in that case, meaning a
      // fresh run already fired — so we must NOT call run() again or we'd
      // race two concurrent estimateFee requests against the backend
      // (vault.estimateFee doesn't accept the AbortController signal, so
      // cancellation isn't reliable). When no stop was active, the explicit
      // run() still covers gas-account fallback paths that emit the same
      // event without ever stopping the chain.
      const resumed = setStopPolling(false);
      if (!resumed) {
        void run();
      }
    };
    appEventBus.on(EAppEventBusNames.EstimateTxFeeRetry, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.EstimateTxFeeRetry, callback);
    };
  }, [run, setStopPolling]);

  useEffect(() => {
    if (currentTxUuid) {
      updateTxFeeInfoInit(false);
    }
  }, [currentTxUuid, updateTxFeeInfoInit]);

  const renderGasAccountSummary = useCallback(() => {
    if (!isGasAccountSelected || isGasAccountFree) {
      return null;
    }

    return (
      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: txFeeCommon?.nativeSymbol,
            keepLeadingZero: true,
          }}
        >
          {gasAccountFeeNative}
        </NumberSizeableText>
        {gasAccountFeeFiat.gt(0) ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            (
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {gasAccountFeeFiat.toFixed()}
            </NumberSizeableText>
            )
          </SizableText>
        ) : null}
      </XStack>
    );
  }, [
    gasAccountFeeFiat,
    gasAccountFeeNative,
    isGasAccountFree,
    isGasAccountSelected,
    settings.currencyInfo.symbol,
    txFeeCommon?.nativeSymbol,
  ]);

  const shouldShowFreeBadge = isMegafuelSponsored || isGasAccountSponsored;
  const sponsoredInfoTitle = intl.formatMessage({
    id: ETranslations.wallet_fee_sponsorship__title,
  });
  const sponsoredCouponSubtitle = intl.formatMessage({
    id: ETranslations.wallet_sponsored_by_onekey__title,
  });
  const sponsoredCouponTitle = intl.formatMessage({
    id: ETranslations.wallet_zero_network_fee__title,
  });
  const sponsoredInfoDescription = intl.formatMessage({
    id: ETranslations.wallet_sponsorship_availability_rules__desc,
  });
  const sponsoredLearnMoreText = intl.formatMessage({
    id: ETranslations.wallet_learn_about_sponsored_fees__action,
  });
  const sponsoredSummaryTitle = intl.formatMessage({
    id: ETranslations.wallet_onekey_sponsored__title,
  });
  const sponsoredSummaryDescription = intl.formatMessage({
    id: ETranslations.wallet_you_pay_zero_network_fee__desc,
  });
  const handleOpenSponsoredFeesHelpCenter = useCallback(() => {
    openUrlExternal(SPONSORED_FEES_HELP_CENTER_URL);
  }, []);

  const renderSponsoredCoupon = useCallback(
    () => (
      <Stack position="relative" alignSelf="stretch">
        <XStack overflow="hidden" borderRadius="$5" bg={sponsoredCouponBgColor}>
          <XStack
            flex={1}
            px="$3.5"
            py="$3"
            gap="$3"
            alignItems="center"
            minWidth={0}
          >
            <Stack
              width={42}
              height={42}
              borderRadius="$full"
              bg={sponsoredCouponIconBgColor}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icon name="GiftSolid" size="$4.5" color="$iconOnColor" />
            </Stack>
            <Stack flex={1} minWidth={0} gap="$1">
              <SizableText
                size="$headingMd"
                color={sponsoredCouponTextColor}
                numberOfLines={1}
              >
                {sponsoredCouponTitle}
              </SizableText>
              <SizableText
                size="$bodySmMedium"
                color={sponsoredCouponSubTextColor}
                numberOfLines={1}
              >
                {sponsoredCouponSubtitle}
              </SizableText>
            </Stack>
          </XStack>
          <Stack
            width={SPONSORED_COUPON_INFO_WIDTH}
            position="relative"
            alignItems="center"
            justifyContent="center"
          >
            <Stack
              position="absolute"
              left={-(SPONSORED_COUPON_SEPARATOR_STROKE / 2)}
              top="$3"
              bottom="$3"
              borderLeftWidth={SPONSORED_COUPON_SEPARATOR_STROKE}
              borderStyle="dashed"
              borderColor={sponsoredCouponSeparatorColor}
              opacity={0.52}
            />
            <Stack
              width={28}
              height={28}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              onPress={handleOpenSponsoredFeesHelpCenter}
              hoverStyle={{ opacity: 0.72 }}
              pressStyle={{ opacity: 0.56 }}
            >
              <Icon name="InfoCircleOutline" size="$4.5" color="$iconSubdued" />
            </Stack>
          </Stack>
        </XStack>
        <Stack
          position="absolute"
          right={SPONSORED_COUPON_INFO_WIDTH - SPONSORED_COUPON_CUTOUT_OFFSET}
          top={-SPONSORED_COUPON_CUTOUT_OFFSET}
          width={SPONSORED_COUPON_CUTOUT_SIZE}
          height={SPONSORED_COUPON_CUTOUT_SIZE}
          borderRadius="$full"
          bg="$bg"
          pointerEvents="none"
        />
        <Stack
          position="absolute"
          right={SPONSORED_COUPON_INFO_WIDTH - SPONSORED_COUPON_CUTOUT_OFFSET}
          bottom={-SPONSORED_COUPON_CUTOUT_OFFSET}
          width={SPONSORED_COUPON_CUTOUT_SIZE}
          height={SPONSORED_COUPON_CUTOUT_SIZE}
          borderRadius="$full"
          bg="$bg"
          pointerEvents="none"
        />
      </Stack>
    ),
    [
      handleOpenSponsoredFeesHelpCenter,
      sponsoredCouponBgColor,
      sponsoredCouponIconBgColor,
      sponsoredCouponSeparatorColor,
      sponsoredCouponSubTextColor,
      sponsoredCouponTitle,
      sponsoredCouponSubtitle,
      sponsoredCouponTextColor,
    ],
  );

  const handleShowSponsoredInfo = useCallback(() => {
    const dialogInstance = Dialog.show({
      title: sponsoredInfoTitle,
      showFooter: false,
      showCancelButton: false,
      renderContent: (
        <Stack gap="$4">
          {renderSponsoredCoupon()}
          <Stack px="$1" gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              {sponsoredInfoDescription}
            </SizableText>
            <SizableText
              size="$bodySmMedium"
              color="$text"
              textDecorationLine="underline"
              cursor="pointer"
              alignSelf="flex-start"
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.7 }}
              onPress={handleOpenSponsoredFeesHelpCenter}
            >
              {sponsoredLearnMoreText}
            </SizableText>
          </Stack>
          <Button
            size="medium"
            onPress={() => {
              void dialogInstance?.close?.();
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_got_it })}
          </Button>
        </Stack>
      ),
    });
    return dialogInstance;
  }, [
    handleOpenSponsoredFeesHelpCenter,
    intl,
    renderSponsoredCoupon,
    sponsoredInfoDescription,
    sponsoredInfoTitle,
    sponsoredLearnMoreText,
  ]);

  const renderSponsoredSummary = useCallback(
    () => (
      <XStack
        alignItems="center"
        gap="$3"
        cursor="pointer"
        onPress={handleShowSponsoredInfo}
        hoverStyle={{ opacity: 0.9 }}
        pressStyle={{ opacity: 0.82 }}
      >
        <Stack flex={1} minWidth={0} gap="$1">
          <DashText
            size="$bodyMd"
            color="$textSubdued"
            dashColor="$textDisabled"
            dashThickness={0.5}
            cursor="pointer"
          >
            {sponsoredSummaryTitle}
          </DashText>
          <SizableText size="$bodyMd" color="$text">
            {sponsoredSummaryDescription}
          </SizableText>
        </Stack>
      </XStack>
    ),
    [
      handleShowSponsoredInfo,
      sponsoredSummaryDescription,
      sponsoredSummaryTitle,
    ],
  );

  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_network_fee,
      }),
      isAsync: true,
      showFooter: false,
      disableDrag: platformEnv.isNative,
      dismissOnOverlayPress: !platformEnv.isNative,
      renderContent: (
        <TxFeeEditor
          networkId={networkId}
          feeSelectorItems={
            isEmpty(feeSelectorItems)
              ? multiTxsFeeSelectorItems.map((item) => ({
                  ...item,
                  feeInfo: item.feeInfos[0],
                }))
              : feeSelectorItems
          }
          selectedFee={selectedFee?.feeInfos?.[0]}
          sendSelectedFee={sendSelectedFee}
          unsignedTxs={unsignedTxs}
          originalCustomFee={customFee}
          onApplyFeeInfo={handleApplyFeeInfo}
          estimateFeeParams={estimateFeeParams}
        />
      ),
    });
  }, [
    customFee,
    estimateFeeParams,
    feeSelectorItems,
    handleApplyFeeInfo,
    intl,
    multiTxsFeeSelectorItems,
    networkId,
    selectedFee?.feeInfos,
    sendSelectedFee,
    unsignedTxs,
  ]);

  const renderFeeEditor = useCallback(() => {
    if (
      !vaultSettings?.editFeeEnabled ||
      !feeInfoEditable ||
      isPayerManagedByService
    ) {
      return null;
    }

    if (sendFeeStatus.errMessage) return null;

    if (!txFeeInfoInit) {
      return (
        <Stack py="$1">
          <Skeleton height="$3" width="$12" />
        </Stack>
      );
    }

    if (!openFeeEditorEnabled) {
      return (
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: getFeeLabel({
              feeType: sendSelectedFee.feeType,
              presetIndex: sendSelectedFee.presetIndex,
              isSinglePreset,
            }),
          })}
        </SizableText>
      );
    }

    return (
      <TxFeeSelectorTrigger
        onPress={handlePress}
        disabled={
          sendFeeStatus.status === ESendFeeStatus.Error || !txFeeInfoInit
        }
      />
    );
  }, [
    feeInfoEditable,
    handlePress,
    intl,
    isPayerManagedByService,
    isSinglePreset,
    openFeeEditorEnabled,
    sendFeeStatus.errMessage,
    sendFeeStatus.status,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFeeInfoInit,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderTotalNative = useCallback(() => {
    if (isPayerManagedByService) {
      return null;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      return (
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: payTokenInfo.symbol,
            keepLeadingZero: true,
          }}
        >
          {payTokenAmount ?? '-'}
        </NumberSizeableText>
      );
    }

    return (
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: txFeeCommon?.nativeSymbol,
          keepLeadingZero: true,
        }}
      >
        {selectedFee?.totalNativeMinForDisplay ?? '-'}
      </NumberSizeableText>
    );
  }, [
    isPayerManagedByService,
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    payTokenInfo,
    payType,
    selectedFee?.totalNativeMinForDisplay,
    txFeeCommon?.nativeSymbol,
  ]);

  const renderTotalFiat = useCallback(() => {
    if (isPayerManagedByService) {
      return null;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      const totalFiat = new BigNumber(payTokenAmount ?? 0).times(
        payTokenInfo.price ?? 0,
      );

      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          (
          <NumberSizeableText
            size="$bodyMd"
            color="$text"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {totalFiat.toFixed() ?? '-'}
          </NumberSizeableText>
          )
        </SizableText>
      );
    }

    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        (
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {selectedFee?.totalFiatMinForDisplay ?? '-'}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    isPayerManagedByService,
    selectedFee?.totalFiatMinForDisplay,
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    payTokenInfo,
    settings.currencyInfo.symbol,
    payType,
    isSwapTrxEnabled,
  ]);

  const renderOriginalFeeInfo = useCallback(() => {
    if (shouldShowFreeBadge) {
      return null;
    }

    if (
      (!isResourceRentalNeeded || !isResourceRentalEnabled) &&
      !transferPayload?.isTronResourceAutoClaimed &&
      !isPayerManagedByService
    ) {
      return null;
    }

    const textColor = '$textSubdued';

    let totalNative = isPayerManagedByService
      ? (selectedFee?.originalTotalNative ??
        selectedFee?.totalNativeMinForDisplay)
      : selectedFee?.totalNativeMinForDisplay;

    let totalFiat = isPayerManagedByService
      ? (selectedFee?.originalTotalFiat ?? selectedFee?.totalFiatMinForDisplay)
      : selectedFee?.totalFiatMinForDisplay;

    if (
      transferPayload?.isTronResourceAutoClaimed &&
      transferPayload?.txOriginalFee
    ) {
      totalNative = transferPayload?.txOriginalFee.totalNative;
      totalFiat = transferPayload?.txOriginalFee.totalFiat;
    }

    return (
      <XStack alignItems="center">
        <SizableText
          size="$bodyMd"
          color={textColor}
          textDecorationLine="line-through"
          textDecorationColor={textColor}
          textDecorationStyle="solid"
        >
          <NumberSizeableText
            size="$bodyMd"
            color={textColor}
            formatter="balance"
            formatterOptions={{
              tokenSymbol: txFeeCommon?.nativeSymbol,
              keepLeadingZero: true,
            }}
          >
            {totalNative ?? '-'}
          </NumberSizeableText>
          (
          <NumberSizeableText
            size="$bodyMd"
            color={textColor}
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {totalFiat ?? '-'}
          </NumberSizeableText>
          )
        </SizableText>
        {sendFeeStatus.discountPercent &&
        sendFeeStatus.discountPercent > 0 &&
        !shouldShowFreeBadge ? (
          <Badge badgeSize="sm" badgeType="success">
            <Badge.Text>
              {sendFeeStatus.discountPercent === 100
                ? intl.formatMessage({
                    id: ETranslations.prime_status_free,
                  })
                : intl.formatMessage(
                    {
                      id: ETranslations.wallet_discount_number,
                    },
                    { number: `${sendFeeStatus.discountPercent}%` },
                  )}
            </Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    );
  }, [
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    transferPayload?.isTronResourceAutoClaimed,
    transferPayload?.txOriginalFee,
    isPayerManagedByService,
    selectedFee?.originalTotalNative,
    selectedFee?.totalNativeMinForDisplay,
    selectedFee?.originalTotalFiat,
    selectedFee?.totalFiatMinForDisplay,
    txFeeCommon?.nativeSymbol,
    settings.currencyInfo.symbol,
    intl,
    shouldShowFreeBadge,
    sendFeeStatus.discountPercent,
  ]);

  useEffect(() => {
    if (txAdvancedSettings.dataChanged) {
      updateTxFeeInfoInit(false);
    }
  }, [
    txAdvancedSettings.dataChanged,
    updateSendSelectedFee,
    updateTxAdvancedSettings,
    updateTxFeeInfoInit,
  ]);

  useEffect(() => {
    let originalTotalFiat = selectedFee?.totalFiatMinForDisplay;
    let totalFiat = selectedFee?.totalFiatMinForDisplay;

    if (
      transferPayload?.isTronResourceAutoClaimed &&
      transferPayload?.txOriginalFee
    ) {
      originalTotalFiat = transferPayload?.txOriginalFee.totalFiat;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      totalFiat = new BigNumber(payTokenAmount ?? 0)
        .times(payTokenInfo.price ?? 0)
        .toFixed();
    }

    if (isPayerManagedByService) {
      totalFiat = '0';
    }

    if (
      !isNil(originalTotalFiat) &&
      !isNil(totalFiat) &&
      new BigNumber(originalTotalFiat ?? 0).gt(0)
    ) {
      const discountPercent = new BigNumber(originalTotalFiat ?? 0)
        .minus(totalFiat ?? 0)
        .dividedBy(originalTotalFiat ?? 0)
        .multipliedBy(100)
        .dp(0)
        .toNumber();

      updateSendFeeStatus({
        discountPercent,
      });
      return;
    }

    updateSendFeeStatus({
      discountPercent: 0,
    });
  }, [
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isPayerManagedByService,
    isSwapTrxEnabled,
    payTokenInfo,
    payType,
    selectedFee?.totalFiatMinForDisplay,
    transferPayload?.isTronResourceAutoClaimed,
    transferPayload?.txOriginalFee,
    updateSendFeeStatus,
  ]);

  const renderFeeSummary = useCallback(() => {
    if (shouldShowFreeBadge) {
      return null;
    }

    if (isGasAccountSelected) {
      return renderGasAccountSummary();
    }

    return (
      <XStack gap="$1" alignItems="center">
        {txFeeInfoInit ? (
          renderTotalNative()
        ) : (
          <Stack py="$1">
            <Skeleton height="$3" width="$24" />
          </Stack>
        )}
        {txFeeInfoInit && !isNil(selectedFee?.totalFiatMinForDisplay)
          ? renderTotalFiat()
          : ''}
      </XStack>
    );
  }, [
    isGasAccountSelected,
    renderGasAccountSummary,
    renderTotalFiat,
    renderTotalNative,
    selectedFee?.totalFiatMinForDisplay,
    shouldShowFreeBadge,
    txFeeInfoInit,
  ]);

  return (
    <Stack {...feeInfoWrapperProps}>
      {shouldShowFreeBadge ? (
        renderSponsoredSummary()
      ) : (
        <>
          <XStack gap="$2" alignItems="center" flexWrap="wrap" pb="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_est_network_fee,
              })}
            </SizableText>
            {vaultSettings?.editFeeEnabled &&
            feeInfoEditable &&
            !sendFeeStatus.errMessage &&
            !isPayerManagedByService ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                •
              </SizableText>
            ) : null}
            {renderFeeEditor()}
          </XStack>
          {renderOriginalFeeInfo()}
          {renderFeeSummary()}
        </>
      )}
    </Stack>
  );
}
export default memo(TxFeeInfo);
