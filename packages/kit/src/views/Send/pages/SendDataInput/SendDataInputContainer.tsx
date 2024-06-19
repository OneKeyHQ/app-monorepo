/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Form,
  Input,
  Page,
  SizableText,
  TextArea,
  XStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { getFormattedNumber } from '@onekeyhq/kit/src/utils/format';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError, OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EAssetSelectorRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { showBalanceDetailsDialog } from '../../../Home/components/BalanceDetailsDialog';
import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import type { RouteProp } from '@react-navigation/core';

function SendDataInputContainer() {
  const intl = useIntl();

  const [isUseFiat, setIsUseFiat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();

  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendDataInput>>();

  const { serviceNFT, serviceToken } = backgroundApiProxy;

  const {
    networkId,
    accountId,
    isNFT,
    token,
    nfts,
    address,
    amount: sendAmount = '',
  } = route.params;
  const nft = nfts?.[0];
  const [tokenInfo, setTokenInfo] = useState(token);
  const { account, network } = useAccountData({ accountId, networkId });
  const sendConfirm = useSendConfirm({ accountId, networkId });

  const isSelectTokenDisabled = allTokens.tokens.length <= 1;

  const tokenMinAmount = useMemo(() => {
    if (!tokenInfo || isNaN(tokenInfo.decimals)) {
      return 0;
    }

    return new BigNumber(1).shiftedBy(-tokenInfo.decimals).toFixed();
  }, [tokenInfo]);

  const {
    result: [
      tokenDetails,
      nftDetails,
      vaultSettings,
      hasFrozenBalance,
      displayMemoForm,
      memoMaxLength,
      numericOnlyMemo,
    ] = [],
    isLoading: isLoadingAssets,
  } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      if (!token && !nft) {
        throw new OneKeyInternalError('token and nft info are both missing.');
      }

      let nftResp: IAccountNFT[] | undefined;
      let tokenResp:
        | ({
            info: IToken;
          } & ITokenFiat)[]
        | undefined;

      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (isNFT && nft) {
        nftResp = await serviceNFT.fetchNFTDetails({
          networkId,
          accountAddress,
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
              networkId,
              accountId,
            },
          );
        const withCheckInscription =
          checkInscriptionProtectionEnabled && settings.inscriptionProtection;
        tokenResp = await serviceToken.fetchTokensDetails({
          networkId,
          accountAddress,
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          }),
          contractList: [tokenInfo.address],
          withFrozenBalance: true,
          withCheckInscription,
        });
      }

      const vs = await backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      });

      const frozenBalanceSettings =
        await backgroundApiProxy.serviceSend.getFrozenBalanceSetting({
          networkId,
          tokenDetails: tokenResp?.[0],
        });

      return [
        tokenResp?.[0],
        nftResp?.[0],
        vs,
        frozenBalanceSettings,
        vs.withMemo,
        vs.memoMaxLength,
        vs.numericOnlyMemo,
      ];
    },
    [
      account,
      accountId,
      isNFT,
      network,
      networkId,
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
  const currencySymbol = settings.currencyInfo.symbol;
  const tokenSymbol = tokenDetails?.info.symbol ?? '';

  const form = useForm({
    defaultValues: {
      to: { raw: address } as IAddressInputValue,
      amount: sendAmount,
      nftAmount: sendAmount || '1',
      memo: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  // token amount or fiat amount
  const amount = form.watch('amount');
  const toPending = form.watch('to.pending');
  const toResolved = form.watch('to.resolved');
  const nftAmount = form.watch('nftAmount');

  const linkedAmount = useMemo(() => {
    let amountBN = new BigNumber(amount ?? 0);
    amountBN = amountBN.isNaN() ? new BigNumber(0) : amountBN;

    const tokenPrice = tokenDetails?.price;

    if (isNil(tokenPrice))
      return {
        amount: '0',
        originalAmount: '0',
      };

    if (isUseFiat) {
      const originalAmount = amountBN.dividedBy(tokenPrice).toFixed();
      return {
        amount: getFormattedNumber(originalAmount, { decimal: 4 }) ?? '0',
        originalAmount,
      };
    }

    const originalAmount = amountBN.times(tokenPrice).toFixed();
    return {
      originalAmount,
      amount: getFormattedNumber(originalAmount, { decimal: 4 }) ?? '0',
    };
  }, [amount, isUseFiat, tokenDetails?.price]);

  const {
    result: { displayAmountFormItem } = { displayAmountFormItem: false },
  } = usePromiseResult(async () => {
    const vs = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });
    if (!vs?.hideAmountInputOnFirstEntry) {
      return {
        displayAmountFormItem: true,
      };
    }
    if (toResolved) {
      const toRaw = form.getValues('to').raw;
      const validation =
        await backgroundApiProxy.serviceValidator.validateAmountInputShown({
          networkId,
          toAddress: toRaw ?? '',
        });
      return {
        displayAmountFormItem: validation.isValid,
      };
    }
    return {
      displayAmountFormItem: false,
    };
  }, [toResolved, networkId, form]);

  const handleOnChangeAmountMode = useCallback(() => {
    setIsUseFiat((prev) => !prev);

    form.setValue('amount', linkedAmount.originalAmount);
  }, [form, linkedAmount]);
  const handleOnSelectToken = useCallback(() => {
    if (isSelectTokenDisabled) return;
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.TokenSelector,
      params: {
        networkId,
        accountId,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
        onSelect: (data: IToken) => {
          setTokenInfo(data);
        },
      },
    });
  }, [
    accountId,
    allTokens.keys,
    allTokens.tokens,
    isSelectTokenDisabled,
    map,
    navigation,
    networkId,
  ]);
  const handleOnConfirm = useCallback(async () => {
    try {
      if (!account) return;
      const toAddress = form.getValues('to').resolved;
      if (!toAddress) return;
      let realAmount = amount;

      setIsSubmitting(true);

      if (isNFT) {
        realAmount = nftAmount;
      } else {
        realAmount = amount;

        if (isUseFiat) {
          if (
            new BigNumber(amount).isGreaterThan(tokenDetails?.fiatValue ?? 0)
          ) {
            realAmount = tokenDetails?.balanceParsed ?? '0';
          } else {
            realAmount = linkedAmount.originalAmount;
          }
        }
      }

      const memoValue = form.getValues('memo');
      const transfersInfo: ITransferInfo[] = [
        {
          from: account.address,
          to: toAddress,
          amount: realAmount,
          nftInfo:
            isNFT && nftDetails
              ? {
                  nftId: nftDetails.itemId,
                  nftAddress: nftDetails.collectionAddress,
                  nftType: nftDetails.collectionType,
                }
              : undefined,
          tokenInfo: !isNFT && tokenDetails ? tokenDetails.info : undefined,
          memo: memoValue,
        },
      ];
      await sendConfirm.navigationToSendConfirm({
        transfersInfo,
        sameModal: true,
        transferPayload: {
          amountToSend: realAmount,
        },
      });
      setIsSubmitting(false);
    } catch (e: any) {
      setIsSubmitting(false);

      throw new OneKeyError({
        message: e.message,
        autoToast: true,
      });
    }
  }, [
    account,
    amount,
    form,
    isNFT,
    isUseFiat,
    linkedAmount.originalAmount,
    nftAmount,
    nftDetails,
    sendConfirm,
    tokenDetails,
  ]);
  const handleValidateTokenAmount = useCallback(
    async (value: string) => {
      const amountBN = new BigNumber(value ?? 0);
      let isInsufficientBalance = false;
      let isLessThanMinTransferAmount = false;
      if (isUseFiat) {
        if (amountBN.isGreaterThan(tokenDetails?.fiatValue ?? 0)) {
          isInsufficientBalance = true;
        }

        if (
          tokenDetails?.price &&
          amountBN
            .dividedBy(tokenDetails.price)
            .isLessThan(vaultSettings?.minTransferAmount ?? 0)
        ) {
          isLessThanMinTransferAmount = true;
        }
      } else {
        if (amountBN.isGreaterThan(tokenDetails?.balanceParsed ?? 0)) {
          isInsufficientBalance = true;
        }

        if (amountBN.isLessThan(vaultSettings?.minTransferAmount ?? 0)) {
          isLessThanMinTransferAmount = true;
        }
      }

      if (isInsufficientBalance)
        return intl.formatMessage(
          {
            id: ETranslations.send_error_insufficient_balance,
          },
          {
            token: tokenSymbol,
          },
        );

      if (isLessThanMinTransferAmount)
        return intl.formatMessage(
          {
            id: ETranslations.send_error_minimum_amount,
          },
          {
            amount: BigNumber.max(
              tokenMinAmount,
              vaultSettings?.minTransferAmount ?? '0',
            ).toFixed(),
            token: tokenSymbol,
          },
        );

      try {
        const toRaw = form.getValues('to').raw;
        await backgroundApiProxy.serviceValidator.validateSendAmount({
          accountId,
          networkId,
          amount: amountBN.toString(),
          tokenBalance: tokenDetails?.balanceParsed ?? '0',
          to: toRaw ?? '',
        });
      } catch (e) {
        console.log('error: ', e);
        return (e as Error).message;
      }

      return true;
    },
    [
      isUseFiat,
      intl,
      tokenSymbol,
      tokenMinAmount,
      vaultSettings?.minTransferAmount,
      tokenDetails?.fiatValue,
      tokenDetails?.price,
      tokenDetails?.balanceParsed,
      form,
      accountId,
      networkId,
    ],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isLoadingAssets || isSubmitting || toPending) return true;

    if (!form.formState.isValid) {
      return true;
    }

    if (isNFT && nft?.collectionType === ENFTType.ERC1155 && !nftAmount) {
      return true;
    }

    if (!isNFT && !amount && displayAmountFormItem) {
      return true;
    }
  }, [
    isLoadingAssets,
    isSubmitting,
    toPending,
    form.formState.isValid,
    isNFT,
    nft?.collectionType,
    nftAmount,
    amount,
    displayAmountFormItem,
  ]);

  const maxAmount = useMemo(() => {
    if (isUseFiat) {
      return tokenDetails?.fiatValue ?? '0';
    }
    return tokenDetails?.balanceParsed ?? '0';
  }, [isUseFiat, tokenDetails?.balanceParsed, tokenDetails?.fiatValue]);

  const renderTokenDataInputForm = useCallback(
    () => (
      <Form.Field
        name="amount"
        label={intl.formatMessage({ id: ETranslations.send_amount })}
        rules={{
          required: true,
          validate: handleValidateTokenAmount,
          onChange: (e: { target: { name: string; value: string } }) => {
            const value = e.target?.value;
            const valueBN = new BigNumber(value ?? 0);
            if (valueBN.isNaN()) {
              const formattedValue = parseFloat(value);
              form.setValue(
                'amount',
                isNaN(formattedValue) ? '' : String(formattedValue),
              );
              return;
            }
            const dp = valueBN.decimalPlaces();
            if (!isUseFiat && dp && dp > (tokenDetails?.info.decimals ?? 0)) {
              form.setValue(
                'amount',
                valueBN.toFixed(tokenDetails?.info.decimals ?? 0),
              );
            }
          },
        }}
      >
        <AmountInput
          reversible
          enableMaxAmount
          balanceProps={{
            loading: isLoadingAssets,
            value: maxAmount,
            onPress: () => {
              form.setValue('amount', maxAmount);
              void form.trigger('amount');
            },
          }}
          valueProps={{
            value: isUseFiat
              ? `${linkedAmount.amount} ${tokenSymbol}`
              : `${currencySymbol}${linkedAmount.amount}`,
            onPress: handleOnChangeAmountMode,
          }}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: isNFT
              ? nft?.metadata?.image
              : tokenInfo?.logoURI,
            selectedNetworkImageUri: network?.logoURI,
            selectedTokenSymbol: isNFT
              ? nft?.metadata?.name
              : tokenInfo?.symbol,
            onPress: isNFT ? undefined : handleOnSelectToken,
            disabled: isSelectTokenDisabled,
          }}
        />
      </Form.Field>
    ),
    [
      currencySymbol,
      form,
      handleOnChangeAmountMode,
      handleOnSelectToken,
      handleValidateTokenAmount,
      intl,
      isLoadingAssets,
      isNFT,
      isSelectTokenDisabled,
      isUseFiat,
      linkedAmount.amount,
      maxAmount,
      network?.logoURI,
      nft?.metadata?.image,
      nft?.metadata?.name,
      tokenDetails?.info.decimals,
      tokenInfo?.logoURI,
      tokenInfo?.symbol,
      tokenSymbol,
    ],
  );
  const renderNFTDataInputForm = useCallback(() => {
    if (nft?.collectionType === ENFTType.ERC1155) {
      return (
        <Form.Field
          name="nftAmount"
          label={intl.formatMessage({ id: ETranslations.send_amount })}
          rules={{ required: true, max: nftDetails?.amount ?? 1, min: 1 }}
        >
          {isLoadingAssets ? null : (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              position="absolute"
              right="$0"
              top="$0"
            >
              Available: {nftDetails?.amount ?? 1}
            </SizableText>
          )}
          <Input
            size="large"
            addOns={[
              {
                loading: isLoadingAssets,
                label: intl.formatMessage({ id: ETranslations.send_max }),
                onPress: () => {
                  form.setValue('nftAmount', nftDetails?.amount ?? '1');
                  void form.trigger('nftAmount');
                },
              },
            ]}
          />
        </Form.Field>
      );
    }
    return null;
  }, [form, intl, isLoadingAssets, nft?.collectionType, nftDetails?.amount]);

  const renderFrozenBalance = useCallback(() => {
    if (!hasFrozenBalance) {
      return false;
    }
    return (
      <XStack py="$2" flex={1}>
        <Alert
          flex={1}
          icon="CoinOutline"
          title={intl.formatMessage({
            id: ETranslations.send_description_frozen_funds_info,
          })}
          action={{
            primary: 'View',
            onPrimaryPress: () =>
              showBalanceDetailsDialog({
                accountId,
                networkId,
              }),
          }}
        />
      </XStack>
    );
  }, [intl, hasFrozenBalance, accountId, networkId]);

  const renderMemoForm = useCallback(() => {
    if (!displayMemoForm) return null;
    const maxLength = memoMaxLength || 256;
    const validateErrMsg = numericOnlyMemo
      ? intl.formatMessage({
          id: ETranslations.send_field_only_integer,
        })
      : undefined;
    const memoRegExp = numericOnlyMemo ? /^[0-9]+$/ : undefined;

    return (
      <>
        <XStack pt="$5" />
        <Form.Field
          label={intl.formatMessage({ id: ETranslations.send_tag })}
          labelAddon={
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.form_optional_indicator,
              })}
            </SizableText>
          }
          name="memo"
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
            validate: (value) => {
              if (!value || !memoRegExp) return undefined;
              const result = !new RegExp(memoRegExp).test(value);
              return result ? validateErrMsg : undefined;
            },
          }}
        >
          <TextArea
            numberOfLines={2}
            size="large"
            placeholder={intl.formatMessage({
              id: ETranslations.send_tag_placeholder,
            })}
          />
        </Form.Field>
      </>
    );
  }, [displayMemoForm, intl, memoMaxLength, numericOnlyMemo]);

  const renderDataInput = useCallback(() => {
    if (isNFT) {
      return renderNFTDataInputForm();
    }
    if (displayAmountFormItem) {
      return (
        <>
          {renderTokenDataInputForm()}
          {renderFrozenBalance()}
          {renderMemoForm()}
        </>
      );
    }
    return null;
  }, [
    displayAmountFormItem,
    isNFT,
    renderNFTDataInputForm,
    renderTokenDataInputForm,
    renderFrozenBalance,
    renderMemoForm,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.send_title })}
      />
      <Page.Body px="$5">
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.addressInput, // can replace with other sceneName
            sceneUrl: '',
          }}
          enabledNum={[0]}
          availableNetworksMap={{
            0: { networkIds: [networkId], defaultNetworkId: networkId },
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
                  <XStack alignItems="center" space="$1" flex={1}>
                    <Token
                      isNFT
                      size="lg"
                      tokenImageUri={nft?.metadata?.image}
                      networkImageUri={network?.logoURI}
                    />
                    <ListItem.Text
                      flex={1}
                      primary={nft?.metadata?.name}
                      secondary={
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {tokenInfo?.name}
                        </SizableText>
                      }
                    />
                  </XStack>
                </ListItem>
              </Form.Field>
            ) : null}
            <Form.Field
              label={intl.formatMessage({ id: ETranslations.send_to })}
              name="to"
              rules={{
                required: true,
                validate: (value: IAddressInputValue) => {
                  if (value.pending) {
                    return;
                  }
                  if (!value.resolved) {
                    return (
                      value.validateError?.message ??
                      intl.formatMessage({
                        id: ETranslations.send_address_invalid,
                      })
                    );
                  }
                },
              }}
            >
              <AddressInput
                accountId={accountId}
                networkId={networkId}
                enableAddressBook
                enableWalletName
                enableVerifySendFundToSelf
                enableAddressInteractionStatus
                contacts
                accountSelector={{ num: 0 }}
              />
            </Form.Field>
            {renderDataInput()}
          </Form>
        </AccountSelectorProviderMirror>
      </Page.Body>
      <Page.Footer
        onConfirm={handleOnConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.send_preview_button,
        })}
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: isSubmitting,
        }}
      />
    </Page>
  );
}

const SendDataInputContainerWithProvider = memo(() => (
  <HomeTokenListProviderMirror>
    <SendDataInputContainer />
  </HomeTokenListProviderMirror>
));
SendDataInputContainerWithProvider.displayName =
  'SendDataInputContainerWithProvider';

export { SendDataInputContainer, SendDataInputContainerWithProvider };
