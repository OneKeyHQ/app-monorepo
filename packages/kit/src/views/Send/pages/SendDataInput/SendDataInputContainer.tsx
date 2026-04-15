/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IFormMode,
  IPageNavigationProp,
  IReValidateMode,
} from '@onekeyhq/components';
import {
  Alert,
  Form,
  Page,
  SizableText,
  TextArea,
  XStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  AddressInputField,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import { renderAddressSecurityHeaderRightButton } from '@onekeyhq/kit/src/components/AddressInput/AddressSecurityHeaderRightButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useValidateMemoField } from '@onekeyhq/kit/src/hooks/useValidateMemoField';
import type {
  IChainValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IModalSendParamList,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalSendRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { isReusableLightningRecipient } from '@onekeyhq/shared/src/utils/lnUrlUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import {
  getAccountIdOnNetwork,
  parseOnChainAmount,
} from '../../../ScanQrCode/hooks/useParseQRCode';
import { SendConfirmProviderMirror } from '../../components/SendConfirmProvider/SendConfirmProviderMirror';

import RecipientQuickSelect from './RecipientQuickSelect';
import {
  normalizeOptionalRecipientText,
  shouldSkipResolvedRecipientUpdate,
} from './recipientSelectionUtils';

import type { RouteProp } from '@react-navigation/core';

interface IFormValues {
  accountId: string;
  networkId: string;
  to: IAddressInputValue;
  amount: string;
  nftAmount: string;
  memo: string;
  paymentId: string;
  note: string;
  txMessage: string;
}

type IQuickSelectRecipient = {
  address: string;
  memo?: string;
  note?: string;
  quickSelectTab?: 'recent' | 'account' | 'addressBook';
  isSearchMode?: boolean;
  searchKeyLength?: number;
  matchCount?: number;
};

type ISendInputFlowParamList = IModalSendParamList &
  IModalSignatureConfirmParamList;
type ISendDataInputRouteName =
  | EModalSendRoutes.SendDataInput
  | EModalSignatureConfirmRoutes.TxDataInput;
type ISendAmountInputParams =
  IModalSignatureConfirmParamList[EModalSignatureConfirmRoutes.TxAmountInput];

function SendDataInputContainer() {
  const intl = useIntl();
  const media = useMedia();

  const [settings] = useSettingsPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<ISendInputFlowParamList>>();

  const addressInputChangeType = useRef(EInputAddressChangeType.Manual);
  const isNavigatingRef = useRef(false);
  const route =
    useRoute<RouteProp<ISendInputFlowParamList, ISendDataInputRouteName>>();
  const amountInputRouteName =
    route.name === EModalSendRoutes.SendDataInput
      ? EModalSendRoutes.SendAmountInput
      : EModalSignatureConfirmRoutes.TxAmountInput;

  const { serviceNFT, serviceToken } = backgroundApiProxy;

  const {
    networkId,
    accountId,
    isNFT,
    token,
    nfts,
    address,
    amount: sendAmount = '',
    onSuccess,
    onFail,
    onCancel,
    isAllNetworks,
  } = route.params;
  const nft = nfts?.[0];
  const [tokenInfo, setTokenInfo] = useState(token);

  const [currentAccount, setCurrentAccount] = useState({
    accountId,
    networkId,
  });

  const [quickSelectActiveTab, setQuickSelectActiveTab] = useState<
    'recent' | 'account' | 'addressBook'
  >('recent');
  const [hasQuickSelectMatches, setHasQuickSelectMatches] = useState(false);
  const [scannedAmount, setScannedAmount] = useState('');

  const pushAmountInput = useCallback(
    (params: ISendAmountInputParams) => {
      if (amountInputRouteName === EModalSendRoutes.SendAmountInput) {
        navigation.push(EModalSendRoutes.SendAmountInput, params);
        return;
      }
      navigation.push(EModalSignatureConfirmRoutes.TxAmountInput, params);
    },
    [amountInputRouteName, navigation],
  );

  const {
    account,
    network,
    vaultSettings,
    deriveType: senderDeriveType,
  } = useAccountData({
    accountId: currentAccount.accountId,
    networkId: currentAccount.networkId,
  });
  const signatureConfirm = useSignatureConfirm({
    accountId: currentAccount.accountId,
    networkId: currentAccount.networkId,
  });
  const [
    displayMemoForm,
    displayPaymentIdForm,
    memoMaxLength,
    numericOnlyMemo,
    displayNoteForm,
    noteMaxLength,
  ] = useMemo(() => {
    return [
      vaultSettings?.withMemo,
      vaultSettings?.withPaymentId,
      vaultSettings?.memoMaxLength,
      vaultSettings?.numericOnlyMemo,
      vaultSettings?.withNote,
      vaultSettings?.noteMaxLength,
    ];
  }, [vaultSettings]);

  // Algo uses Note instead of Memo; history memos should map to the note field
  const isNoteOnlyChain = displayNoteForm && !displayMemoForm;

  const { result: [tokenDetails] = [] } = usePromiseResult(
    async () => {
      if (!account?.id || !network?.id) return;
      if (!token && !nft) {
        throw new OneKeyInternalError('token and nft info are both missing.');
      }

      let nftResp: IAccountNFT[] | undefined;
      let tokenResp:
        | ({
            info: IToken;
          } & ITokenFiat)[]
        | undefined;

      if (isNFT && nft) {
        nftResp = await serviceNFT.fetchNFTDetails({
          accountId: account.id,
          networkId: network.id,
          nfts: [
            {
              collectionAddress: nft.collectionAddress,
              itemId: nft.itemId,
            },
          ],
        });
      } else if (!isNFT && tokenInfo) {
        const checkInscriptionProtectionEnabled =
          await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
            {
              networkId: network.id,
              accountId: account.id,
            },
          );
        const withCheckInscription =
          checkInscriptionProtectionEnabled && settings.inscriptionProtection;
        tokenResp = await serviceToken.fetchTokensDetails({
          networkId: network.id,
          accountId: account.id,
          contractList: [tokenInfo.address],
          withFrozenBalance: true,
          withCheckInscription,
        });
      }

      const frozenBalanceSettings =
        await backgroundApiProxy.serviceSend.getFrozenBalanceSetting({
          networkId: network.id,
          tokenDetails: tokenResp?.[0],
        });

      return [tokenResp?.[0], nftResp?.[0], frozenBalanceSettings];
    },
    [
      account,
      isNFT,
      network,
      nft,
      serviceNFT,
      serviceToken,
      token,
      tokenInfo,
      settings.inscriptionProtection,
    ],
    { watchLoading: true, alwaysSetState: true },
  );

  if (tokenDetails && isNil(tokenDetails?.balanceParsed)) {
    tokenDetails.balanceParsed = new BigNumber(tokenDetails.balance)
      .shiftedBy(tokenDetails.info.decimals * -1)
      .toFixed();
  }
  const formOptions = useMemo(
    () => ({
      defaultValues: {
        accountId,
        networkId,
        to: { raw: address } as IAddressInputValue,
        amount: sendAmount,
        nftAmount: sendAmount || '1',
        memo: '',
        paymentId: '',
        note: '',
        txMessage: '',
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
    }),
    [accountId, address, networkId, sendAmount],
  );

  const form = useForm<IFormValues>(formOptions);

  const memoValue = form.watch('memo') as string | undefined;
  const noteValue = form.watch('note') as string | undefined;
  const paymentIdValue = form.watch('paymentId') as string | undefined;
  // Don't include isValidating — async memo validation (XRP vault) would
  // otherwise make the Next button flicker on every keystroke (OK-52883).
  // handleNavigateToAmountInput awaits form.trigger() as the final guard, so
  // it's safe to keep the button enabled while async validation is pending.
  const isNextDisabled = Boolean(
    form.formState.errors.memo ||
    form.formState.errors.paymentId ||
    form.formState.errors.note,
  );

  const toValue = form.watch('to') as IAddressInputValue | undefined;
  const toPending = toValue?.pending;
  const toResolved = toValue?.resolved;
  const toAddressRaw = toValue?.raw;
  const toSimilarAddress = toValue?.similarAddress;

  const onScanResult = useCallback(
    async (result: IQRCodeHandlerParseResult<IChainValue>) => {
      if (
        result.type === EQRCodeHandlerType.UNKNOWN ||
        !result?.data?.network
      ) {
        return;
      }
      const tokenAddress = result?.data?.tokenAddress;
      const scanNetworkId =
        result?.data?.network?.id || currentAccount.networkId;
      const scanAccountId =
        (await getAccountIdOnNetwork({
          account,
          network: result.data.network,
        })) || currentAccount?.accountId;

      if (scanAccountId) {
        let scanToken: IToken | null = null;
        if (tokenAddress) {
          scanToken = await backgroundApiProxy.serviceToken.getToken({
            networkId: scanNetworkId,
            accountId: scanAccountId,
            tokenIdOnNetwork: tokenAddress,
          });
        }
        if (!scanToken) {
          scanToken = await backgroundApiProxy.serviceToken.getNativeToken({
            networkId: scanNetworkId,
            accountId: scanAccountId,
          });
        }
        if (scanToken) {
          const amountFromScan = await parseOnChainAmount(result, scanToken);
          if (amountFromScan) {
            setScannedAmount(amountFromScan);
          }
          const formNetworkId = form.getValues('networkId');
          if (formNetworkId === scanNetworkId) {
            if (currentAccount.accountId && scanNetworkId) {
              setCurrentAccount({
                accountId: currentAccount.accountId,
                networkId: scanNetworkId,
              });
              setTokenInfo(scanToken);
            }
          }
        }
      }
    },
    [account, currentAccount.accountId, currentAccount.networkId, form],
  );

  const handleNavigateToAmountInput = useCallback(async () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    try {
      // Use already-watched toResolved instead of re-getting from form
      if (!toResolved) return;

      // Validate memo/paymentId/note fields before navigating
      const isValid = await form.trigger();
      if (!isValid) return;

      defaultLogger.transaction.send.addressInput({
        addressInputMethod: addressInputChangeType.current,
      });

      const nextMemoValue = form.getValues('memo')?.trim();
      const nextPaymentIdValue = form.getValues('paymentId');
      const nextNoteValue = form.getValues('note');

      // Reuse the matching amount-input route for the active modal stack.
      const toVal = form.getValues('to') as IAddressInputValue | undefined;

      const isLightning = networkUtils.isLightningNetworkByNetworkId(
        currentAccount.networkId,
      );

      // For LNURL / Lightning Address, skip amount page — LnurlPayRequestModal
      // handles amount input, comment, and metadata display (OK-52507, OK-52671).
      // Must check before invoice decode to avoid passing LNURL to decodedInvoice.
      const rawInput = (toVal?.raw ?? '').trim();
      if (isLightning && account && isReusableLightningRecipient(rawInput)) {
        const transfersInfo: ITransferInfo[] = [
          {
            from: account.address,
            to: rawInput,
            amount: '0',
            tokenInfo: tokenInfo ?? undefined,
          },
        ];
        await signatureConfirm.navigationToTxConfirm({
          transfersInfo,
          sameModal: true,
          onSuccess,
          onFail,
          onCancel,
          transferPayload: {
            amountToSend: '0',
            isMaxSend: false,
            isNFT: false,
            originalRecipient: rawInput,
            isToContract: false,
          },
          isInternalTransfer: true,
        });
        return;
      }

      // For Lightning invoices, decode the invoice to extract embedded amount
      let invoiceAmount: string | undefined;
      let isInvoiceAmountLocked = false;
      if (isLightning && toResolved) {
        try {
          const isZeroAmount =
            await backgroundApiProxy.serviceLightning.isZeroAmountInvoice({
              paymentRequest: toResolved,
              networkId: currentAccount.networkId,
              accountId: currentAccount.accountId,
            });
          if (!isZeroAmount) {
            const decoded =
              await backgroundApiProxy.serviceLightning.decodedInvoice({
                paymentRequest: toResolved,
                networkId: currentAccount.networkId,
                accountId: currentAccount.accountId,
              });
            const sats =
              decoded.satoshis ??
              (decoded.millisatoshis
                ? Math.floor(Number(decoded.millisatoshis) / 1000)
                : undefined);
            if (sats && sats > 0) {
              invoiceAmount = String(sats);
              isInvoiceAmountLocked = true;
            }
          }
        } catch {
          // If decoding fails, let user enter amount manually
        }
      }

      // For fixed-amount Lightning invoices, skip amount page and go to confirm
      if (isInvoiceAmountLocked && invoiceAmount && account) {
        const transfersInfo: ITransferInfo[] = [
          {
            from: account.address,
            to: toResolved,
            amount: invoiceAmount,
            tokenInfo: tokenInfo ?? undefined,
          },
        ];
        await signatureConfirm.navigationToTxConfirm({
          transfersInfo,
          sameModal: true,
          onSuccess,
          onFail,
          onCancel,
          transferPayload: {
            amountToSend: invoiceAmount,
            isMaxSend: false,
            isNFT: false,
            originalRecipient: toResolved,
            isToContract: false,
          },
          isInternalTransfer: true,
        });
        return;
      }

      // ERC-721 NFTs are 1-of-1 so there is nothing to enter on the amount
      // page — skip straight to confirm with a fixed quantity of 1 (OK-53248).
      const nftItem = nfts?.[0];
      if (
        isNFT &&
        nftItem &&
        nftItem.collectionType !== ENFTType.ERC1155 &&
        account
      ) {
        const transfersInfo: ITransferInfo[] = [
          {
            from: account.address,
            to: toResolved,
            amount: '1',
            nftInfo: {
              nftId: nftItem.itemId,
              nftAddress: nftItem.collectionAddress,
              nftType: nftItem.collectionType,
            },
            memo: nextMemoValue || undefined,
            paymentId: nextPaymentIdValue || undefined,
            note: nextNoteValue || undefined,
          },
        ];
        await signatureConfirm.navigationToTxConfirm({
          transfersInfo,
          sameModal: true,
          onSuccess,
          onFail,
          onCancel,
          transferPayload: {
            amountToSend: '1',
            isMaxSend: false,
            isNFT: true,
            originalRecipient: toResolved,
            isToContract: !!toVal?.isContract,
            memo: nextMemoValue || undefined,
            paymentId: nextPaymentIdValue || undefined,
            note: nextNoteValue || undefined,
          },
          isInternalTransfer: true,
        });
        return;
      }

      pushAmountInput({
        networkId: currentAccount.networkId,
        accountId: currentAccount.accountId,
        isNFT,
        token: tokenInfo,
        nfts,
        recipientAddress: toResolved,
        recipientMemo: nextMemoValue || undefined,
        recipientPaymentId: nextPaymentIdValue || undefined,
        recipientNote: nextNoteValue || undefined,
        recipientIsContract: toVal?.isContract,
        amount: invoiceAmount || scannedAmount || sendAmount || undefined,
        isInvoiceAmountLocked,
        isAllNetworks,
        onSuccess,
        onFail,
        onCancel,
      });
    } catch (e) {
      console.error('Navigate to amount input failed:', e);
    } finally {
      isNavigatingRef.current = false;
    }
  }, [
    account,
    toResolved,
    form,
    pushAmountInput,
    signatureConfirm,
    scannedAmount,
    sendAmount,
    currentAccount.networkId,
    currentAccount.accountId,
    isNFT,
    tokenInfo,
    nfts,
    isAllNetworks,
    onSuccess,
    onFail,
    onCancel,
  ]);

  const validateMemoField = useValidateMemoField({
    networkId: currentAccount.networkId,
    accountId: currentAccount.accountId,
    numericOnlyMemo,
    supportMemoValidation: vaultSettings?.supportMemoValidation,
    tokenAddress: tokenInfo?.address,
  });

  const renderMemoForm = useCallback(() => {
    if (!displayMemoForm) return null;
    const maxLength = memoMaxLength || 256;
    const isNumericMemo = Boolean(numericOnlyMemo);
    let memoInputLines = 2;
    if (isNumericMemo) {
      memoInputLines = memoValue?.length ? 2 : 1;
    }
    return (
      <>
        <Form.Field
          label={intl.formatMessage({ id: ETranslations.send_tag })}
          optional
          name="memo"
          labelAddon={
            memoValue ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                cursor="pointer"
                hoverStyle={{ color: '$text' }}
                onPress={() =>
                  form.setValue('memo', '', {
                    shouldValidate: true,
                  })
                }
              >
                {intl.formatMessage({ id: ETranslations.global_clear })}
              </SizableText>
            ) : undefined
          }
          rules={{
            maxLength: {
              value: maxLength,
              message: intl.formatMessage(
                {
                  id: ETranslations.dapp_connect_msg_description_can_be_up_to_int_characters,
                },
                {
                  number: maxLength,
                },
              ),
            },
            validate: validateMemoField,
          }}
        >
          <TextArea
            numberOfLines={memoInputLines}
            size={media.gtMd ? 'medium' : 'large'}
            placeholder={intl.formatMessage({
              id: ETranslations.send_tag_placeholder,
            })}
            keyboardType={
              isNumericMemo && platformEnv.isNative ? 'number-pad' : undefined
            }
          />
        </Form.Field>
      </>
    );
  }, [
    displayMemoForm,
    form,
    intl,
    media.gtMd,
    memoMaxLength,
    memoValue,
    numericOnlyMemo,
    validateMemoField,
  ]);

  const renderPaymentIdForm = useCallback(() => {
    if (!displayPaymentIdForm) return null;
    return (
      <>
        <XStack pt="$5" />
        <Form.Field
          label="Payment ID"
          optional
          name="paymentId"
          labelAddon={
            paymentIdValue ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                cursor="pointer"
                hoverStyle={{ color: '$text' }}
                onPress={() =>
                  form.setValue('paymentId', '', {
                    shouldValidate: true,
                  })
                }
              >
                {intl.formatMessage({ id: ETranslations.global_clear })}
              </SizableText>
            ) : undefined
          }
          rules={{
            validate: (value) => {
              if (!value) return undefined;
              if (
                !hexUtils.isHexString(hexUtils.addHexPrefix(value)) ||
                hexUtils.stripHexPrefix(value).length !== 64
              ) {
                return intl.formatMessage({
                  id: ETranslations.form_payment_id_error_text,
                });
              }
            },
          }}
        >
          <TextArea
            numberOfLines={2}
            size={media.gtMd ? 'medium' : 'large'}
            placeholder="Payment ID"
          />
        </Form.Field>
      </>
    );
  }, [displayPaymentIdForm, form, intl, media.gtMd, paymentIdValue]);

  const renderNoteForm = useCallback(() => {
    if (!displayNoteForm) return null;
    const maxLength = noteMaxLength ?? 512;
    return (
      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_Note,
        })}
        optional
        name="note"
        labelAddon={
          noteValue ? (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              cursor="pointer"
              hoverStyle={{ color: '$text' }}
              onPress={() =>
                form.setValue('note', '', { shouldValidate: true })
              }
            >
              {intl.formatMessage({ id: ETranslations.global_clear })}
            </SizableText>
          ) : undefined
        }
        rules={{
          maxLength: {
            value: maxLength,
            message: intl.formatMessage(
              {
                id: ETranslations.send_memo_up_to_length,
              },
              {
                number: maxLength,
              },
            ),
          },
        }}
      >
        <TextArea
          numberOfLines={2}
          size={media.gtMd ? 'medium' : 'large'}
          placeholder={intl.formatMessage({
            id: ETranslations.global_Note,
          })}
        />
      </Form.Field>
    );
  }, [displayNoteForm, form, intl, media.gtMd, noteMaxLength, noteValue]);

  const renderDataInput = useCallback(() => {
    return (
      <>
        {renderMemoForm()}
        {renderPaymentIdForm()}
        {renderNoteForm()}
      </>
    );
  }, [renderMemoForm, renderPaymentIdForm, renderNoteForm]);

  useEffect(() => {
    if (token || nft) {
      defaultLogger.transaction.send.sendSelect({
        network: currentAccount.networkId,
        tokenAddress:
          token?.address ??
          `${nft?.collectionAddress ?? ''}:${nft?.itemId ?? ''}`,
        tokenSymbol: token?.symbol,
        tokenType: isNFT ? 'NFT' : 'Token',
      });
    }
  }, [networkId, token, nft, isNFT, currentAccount.networkId]);

  // Prefetch common modal bundles after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void Promise.all([
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Receive/pages/ReceiveToken'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/AddressBook/pages/ListItem'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/ScanQrCode/pages/ScanQrCodeModal'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Send/pages/SendConfirm/SendConfirmContainer'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Send/pages/SendConfirmFromDApp/SendConfirmFromDApp'
        ),
        import(
          /* webpackPrefetch: true */ '@onekeyhq/kit/src/views/Send/pages/SendConfirmFromSwap/SendConfirmFromSwap'
        ),
      ]);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleAddressInputChangeType = useCallback(
    (type: EInputAddressChangeType) => {
      addressInputChangeType.current = type;
    },
    [],
  );

  const enableAllowListValidation = useMemo(
    () => !networkUtils.isLightningNetworkByNetworkId(networkId),
    [networkId],
  );

  const fillRecipientFromQuickSelect = useCallback(
    ({
      selectedAddress,
      selectedMemo,
      selectedNote,
    }: {
      selectedAddress: string;
      selectedMemo?: string;
      selectedNote?: string;
    }) => {
      const memoText = normalizeOptionalRecipientText(selectedMemo);
      const noteText = normalizeOptionalRecipientText(selectedNote);
      form.setValue('memo', displayMemoForm ? memoText : '', {
        shouldValidate: true,
      });
      form.setValue('note', noteText || (isNoteOnlyChain ? memoText : ''), {
        shouldValidate: true,
      });

      const currentTo = form.getValues('to') as IAddressInputValue | undefined;
      // Skip resetting when the same address is already resolved,
      // otherwise we'd wipe the resolved state and the validation
      // won't re-trigger (same raw text), causing the Next button
      // to disappear.
      if (
        shouldSkipResolvedRecipientUpdate({
          currentTo,
          selectedAddress,
        })
      ) {
        return;
      }

      form.setValue(
        'to',
        {
          raw: selectedAddress,
          pending: true,
          resolved: undefined,
          isContract: undefined,
          validateError: undefined,
          similarAddress: undefined,
        },
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        },
      );
    },
    [displayMemoForm, isNoteOnlyChain, form],
  );

  const shouldStayOnDataStepForQuickSelect = useCallback(
    ({
      selectedMemo,
      selectedNote,
    }: {
      selectedMemo?: string;
      selectedNote?: string;
    }) => {
      const hasSelectedMemo = Boolean(selectedMemo?.trim());
      const hasSelectedNote = Boolean(selectedNote?.trim());
      const needsMemoInput = vaultSettings?.withMemo && !hasSelectedMemo;
      const needsPaymentId =
        vaultSettings?.withPaymentId && !form.getValues('paymentId');
      const needsNote =
        vaultSettings?.withNote && !hasSelectedNote && !hasSelectedMemo;
      return needsMemoInput || needsPaymentId || needsNote;
    },
    [
      form,
      vaultSettings?.withMemo,
      vaultSettings?.withNote,
      vaultSettings?.withPaymentId,
    ],
  );

  const navigateQuickSelectRecipientToAmount = useCallback(
    async ({
      selectedAddress,
      selectedMemo,
      selectedNote,
    }: {
      selectedAddress: string;
      selectedMemo?: string;
      selectedNote?: string;
    }) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      try {
        const queryResult =
          await backgroundApiProxy.serviceAccountProfile.queryAddress({
            networkId: currentAccount.networkId,
            accountId: currentAccount.accountId,
            address: selectedAddress,
            enableNameResolve: true,
            enableAddressBook: true,
            enableWalletName: true,
            enableAddressContract: true,
            enableVerifySendFundToSelf: true,
            enableAllowListValidation,
            ignoreSimilarAddressInAddressBook: true,
            enableCheckSimilarAddressInAddressBook: true,
          });
        if (queryResult.validStatus !== 'valid' || queryResult.similarAddress) {
          // Address invalid — fall back to input for feedback
          fillRecipientFromQuickSelect({
            selectedAddress,
            selectedMemo,
            selectedNote,
          });
          void form.trigger('to');
          return;
        }
        const resolvedAddress =
          queryResult.resolveAddress ||
          queryResult.validAddress ||
          selectedAddress;

        defaultLogger.transaction.send.addressInput({
          addressInputMethod: addressInputChangeType.current,
        });

        const effectiveNote =
          selectedNote || (isNoteOnlyChain ? selectedMemo?.trim() : undefined);
        pushAmountInput({
          networkId: currentAccount.networkId,
          accountId: currentAccount.accountId,
          isNFT,
          token: tokenInfo,
          nfts,
          recipientAddress: resolvedAddress,
          recipientIsContract: queryResult.isContract ?? false,
          recipientMemo: displayMemoForm
            ? selectedMemo?.trim() || undefined
            : undefined,
          recipientPaymentId: form.getValues('paymentId') || undefined,
          recipientNote: effectiveNote || undefined,
          amount: scannedAmount || sendAmount || undefined,
          isAllNetworks,
          onSuccess,
          onFail,
          onCancel,
        });
      } catch {
        // Validation failed — fall back to filling input
        fillRecipientFromQuickSelect({
          selectedAddress,
          selectedMemo,
          selectedNote,
        });
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [
      currentAccount.accountId,
      currentAccount.networkId,
      displayMemoForm,
      isNoteOnlyChain,
      fillRecipientFromQuickSelect,
      form,
      enableAllowListValidation,
      isAllNetworks,
      isNFT,
      nfts,
      onCancel,
      onFail,
      onSuccess,
      pushAmountInput,
      scannedAmount,
      sendAmount,
      tokenInfo,
    ],
  );

  const handleQuickSelectRecipient = useCallback(
    ({
      address: selectedAddress,
      memo: selectedMemo,
      note: selectedNote,
      quickSelectTab,
      isSearchMode: selectIsSearchMode,
      searchKeyLength: selectSearchKeyLength,
      matchCount: selectMatchCount,
    }: IQuickSelectRecipient) => {
      const isFromAccount =
        addressInputChangeType.current ===
        EInputAddressChangeType.AccountSelector;
      const isFromAddressBook =
        addressInputChangeType.current === EInputAddressChangeType.AddressBook;

      let recipientType: 'walletAccount' | 'addressBook' | 'recentRecipient' =
        'recentRecipient';
      if (isFromAccount) recipientType = 'walletAccount';
      else if (isFromAddressBook) recipientType = 'addressBook';

      if (quickSelectTab) {
        defaultLogger.transaction.send.quickSelectTap({
          network: currentAccount.networkId,
          tab: quickSelectTab,
          recipientType,
          isSearchMode: selectIsSearchMode ?? false,
          searchKeyLength: selectSearchKeyLength ?? 0,
          matchCount: selectMatchCount ?? 0,
        });
      }

      if (isFromAccount || isFromAddressBook) {
        const willSkip = !shouldStayOnDataStepForQuickSelect({
          selectedMemo,
          selectedNote,
        });

        if (quickSelectTab) {
          defaultLogger.transaction.send.quickSelectNavigation({
            network: currentAccount.networkId,
            tab: quickSelectTab,
            skippedToAmount: willSkip,
          });
        }

        if (!willSkip) {
          fillRecipientFromQuickSelect({
            selectedAddress,
            selectedMemo,
            selectedNote,
          });
          return;
        }

        // Fill form immediately so back-navigation shows the selection.
        fillRecipientFromQuickSelect({
          selectedAddress,
          selectedMemo,
          selectedNote,
        });

        void navigateQuickSelectRecipientToAmount({
          selectedAddress,
          selectedMemo,
          selectedNote,
        });
        return;
      }

      // For recent recipients / paste / manual: fill the input
      // and let the user review before proceeding.
      if (quickSelectTab) {
        defaultLogger.transaction.send.quickSelectNavigation({
          network: currentAccount.networkId,
          tab: quickSelectTab,
          skippedToAmount: false,
        });
      }
      fillRecipientFromQuickSelect({
        selectedAddress,
        selectedMemo,
        selectedNote,
      });
    },
    [
      currentAccount.networkId,
      fillRecipientFromQuickSelect,
      navigateQuickSelectRecipientToAmount,
      shouldStayOnDataStepForQuickSelect,
    ],
  );

  return (
    <Page
      scrollEnabled
      safeAreaEnabled
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <Page.Header
        title={intl.formatMessage({
          id: networkUtils.isLightningNetworkByNetworkId(
            currentAccount.networkId,
          )
            ? ETranslations.send_title
            : ETranslations.select_address__title,
        })}
        headerRight={
          enableAllowListValidation
            ? renderAddressSecurityHeaderRightButton
            : undefined
        }
      />
      <Page.Body px="$5" testID="send-recipient-amount-form">
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.addressInput, // can replace with other sceneName
            sceneUrl: '',
          }}
          enabledNum={[0]}
          availableNetworksMap={{
            0: {
              networkIds: [currentAccount.networkId],
              defaultNetworkId: currentAccount.networkId,
            },
          }}
        >
          <Form form={form}>
            {isNFT ? (
              <Form.Field
                label={intl.formatMessage({ id: ETranslations.global_nft })}
                name="nft"
              >
                <ListItem
                  mx="$0"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$2"
                >
                  <XStack alignItems="center" gap="$1" flex={1}>
                    <Token
                      isNFT
                      size="lg"
                      tokenImageUri={nft?.metadata?.image}
                      networkImageUri={network?.logoURI}
                      networkId={network?.id}
                      showNetworkIcon
                    />
                    <ListItem.Text
                      flex={1}
                      primary={nft?.metadata?.name ?? ''}
                      secondary={
                        <SizableText
                          size="$bodyMd"
                          color="$textSubdued"
                          style={
                            platformEnv.isNative
                              ? undefined
                              : { wordBreak: 'break-all' }
                          }
                        >
                          {!isNil(nft?.itemId)
                            ? `${intl.formatMessage({
                                id: ETranslations.nft_token_id,
                              })}: ${accountUtils.shortenAddress({
                                address: nft.itemId,
                                leadingLength: 6,
                              })}`
                            : ''}
                        </SizableText>
                      }
                    />
                  </XStack>
                </ListItem>
              </Form.Field>
            ) : null}
            <AddressInputField
              name="to"
              numberOfLines={
                networkUtils.isLightningNetworkByNetworkId(
                  currentAccount.networkId,
                )
                  ? 5
                  : 2
              }
              actionsLayout="recipient"
              placeholder={
                // Lightning has its own placeholder ("Enter invoice, Lightning Address or LNURL")
                networkUtils.isLightningNetworkByNetworkId(
                  currentAccount.networkId,
                )
                  ? undefined
                  : intl.formatMessage({
                      id: ETranslations.search_or_paste_address__desc,
                    })
              }
              onScanResult={onScanResult}
              accountId={currentAccount.accountId}
              networkId={currentAccount.networkId}
              enableAddressBook
              enableWalletName
              enableVerifySendFundToSelf
              enableAddressInteractionStatus
              enableAddressContract
              enableAllowListValidation={enableAllowListValidation}
              onInputTypeChange={handleAddressInputChangeType}
              hideNonBackedUpWallet
              ignoreSimilarAddressInAddressBook
              enableCheckSimilarAddressInAddressBook
              hasQuickSelectMatches={hasQuickSelectMatches}
            />
            {toSimilarAddress ? (
              <Alert
                type="warning"
                title={intl.formatMessage({
                  id: ETranslations.wallet_address_poisoning_alert,
                })}
              />
            ) : null}
            {renderDataInput()}
            <RecipientQuickSelect
              accountId={currentAccount.accountId}
              networkId={currentAccount.networkId}
              senderDeriveType={senderDeriveType}
              searchKey={toAddressRaw}
              isSearchMode={!!toAddressRaw?.trim()}
              activeTab={quickSelectActiveTab}
              onActiveTabChange={setQuickSelectActiveTab}
              onInputTypeChange={handleAddressInputChangeType}
              onMatchStatusChange={setHasQuickSelectMatches}
              onSelect={handleQuickSelectRecipient}
            />
          </Form>
        </AccountSelectorProviderMirror>
      </Page.Body>
      {toResolved && !toPending ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirm={handleNavigateToAmountInput}
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_next,
            })}
            confirmButtonProps={{
              loading: false,
              // Don't use form.formState.isValid here — the async address
              // validation (AddressInput queryAddress) can leave isValid stale.
              // toResolved && !toPending already gates address validity.
              // Only disable for data-step field errors or in-flight validation.
              // handleNavigateToAmountInput still calls form.trigger() as a final
              // guard before navigating.
              disabled: isNextDisabled,
            }}
          />
        </Page.Footer>
      ) : null}
    </Page>
  );
}

const SendDataInputContainerWithProvider = memo(() => (
  <SendConfirmProviderMirror>
    <HomeTokenListProviderMirror>
      <SendDataInputContainer />
    </HomeTokenListProviderMirror>
  </SendConfirmProviderMirror>
));
SendDataInputContainerWithProvider.displayName =
  'SendDataInputContainerWithProvider';

export { SendDataInputContainer };

export default SendDataInputContainerWithProvider;
