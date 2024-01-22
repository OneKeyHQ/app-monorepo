/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { debounce, isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { YStack } from 'tamagui';

import {
  Form,
  Icon,
  IconButton,
  Input,
  ListItem,
  Page,
  SizableText,
  XStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  NameResolver,
  useNameResolverState,
} from '@onekeyhq/kit/src/components/NameResolver';
import type { INameResolverState } from '@onekeyhq/kit/src/components/NameResolver';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getFormattedNumber } from '@onekeyhq/kit/src/utils/format';
import { mockGetNetwork } from '@onekeyhq/kit-bg/src/mock';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { checkIsDomain } from '@onekeyhq/shared/src/utils/uriUtils';
import { ENFTType } from '@onekeyhq/shared/types/nft';

import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendDataInputContainer() {
  const intl = useIntl();

  const [isUseFiat, setIsUseFiat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameToResolve, setNameToResolve] = useState('');
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendDataInput>>();

  const {
    onChange: onNameResolverChange,
    isValid: isValidName,
    isSearching: isSearchingName,
    address: resolvedAddress,
  } = useNameResolverState();

  const { serviceNFT, serviceSend, serviceAccount, serviceToken } =
    backgroundApiProxy;

  const { networkId, accountId, isNFT, token, nfts } = route.params;
  const nft = nfts?.[0];

  const getAccount = useCallback(
    async () =>
      serviceAccount.getAccountOfWallet({
        accountId,
        indexedAccountId: '',
        networkId,
        deriveType: 'default',
      }),
    [accountId, networkId, serviceAccount],
  );

  const network = usePromiseResult(
    () => mockGetNetwork({ networkId }),
    [networkId],
  ).result;

  const { result: nftDetails, isLoading: isLoadingNFT } = usePromiseResult(
    async () => {
      if (!isNFT) return;
      const account = await getAccount();
      const r = await serviceNFT.fetchNFTDetails({
        networkId,
        accountAddress: account.address,
        collectionAddress: nft?.collectionAddress ?? '',
        itemId: nft?.itemId ?? '',
      });
      return r;
    },
    [
      getAccount,
      isNFT,
      networkId,
      nft?.collectionAddress,
      nft?.itemId,
      serviceNFT,
    ],
    { watchLoading: true },
  );

  const { result: tokenDetails, isLoading: isLoadingToken } = usePromiseResult(
    async () => {
      if (isNFT) return;
      const account = await getAccount();
      const r = await serviceToken.fetchTokenDetails({
        networkId,
        accountAddress: account.address,
        address: token?.address ?? '',
        isNative: token?.isNative ?? false,
      });
      return r;
    },
    [
      getAccount,
      isNFT,
      networkId,
      serviceToken,
      token?.address,
      token?.isNative,
    ],
    { watchLoading: true },
  );

  const currencySymbol = settings.currencyInfo.symbol;
  const tokenSymbol = tokenDetails?.info.symbol ?? '';

  const form = useForm({
    defaultValues: {
      to: '',
      amount: '',
      nftAmount: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  // token amount or fiat amount
  const amount = form.watch('amount');
  const toAddress = form.watch('to');

  const linkedAmount = useMemo(() => {
    const amountBN = new BigNumber(amount ?? 0);

    const tokenPrice = tokenDetails?.price;

    if (isNil(tokenPrice)) return '0';

    if (isUseFiat) {
      return (
        getFormattedNumber(amountBN.dividedBy(tokenPrice), { decimal: 4 }) ??
        '0'
      );
    }
    return (
      getFormattedNumber(amountBN.times(tokenPrice), { decimal: 4 }) ?? '0'
    );
  }, [amount, isUseFiat, tokenDetails?.price]);

  useEffect(() => {
    const subscription = form.watch(
      debounce((value, { name, type }) => {
        if (name === 'to' && type === 'change') {
          setNameToResolve(value.to);
          if (!checkIsDomain(value.to)) {
            // TODO validate address
          }
        }
      }, 1000),
    );
    return () => subscription.unsubscribe();
  }, [form, setNameToResolve]);

  const handleOnChangeAmountMode = useCallback(() => {
    setIsUseFiat((prev) => !prev);
    form.setValue('amount', linkedAmount);
  }, [form, linkedAmount]);
  const handleOnSelectToken = useCallback(() => navigation.pop(), [navigation]);
  const handleOnSendMax = useCallback(() => {
    if (isUseFiat) {
      form.setValue('amount', tokenDetails?.fiatValue ?? '0');
    } else {
      form.setValue('amount', tokenDetails?.balanceParsed ?? '0');
    }
    void form.trigger('amount');
  }, [form, isUseFiat, tokenDetails?.balanceParsed, tokenDetails?.fiatValue]);
  const handleOnConfirm = useCallback(async () => {
    try {
      setIsSubmitting(true);

      const account = await getAccount();

      const transfersInfo: ITransferInfo[] = [
        {
          from: account.address,
          to: isValidName ? resolvedAddress : toAddress,
          amount,
          nftInfo:
            isNFT && nftDetails
              ? {
                  nftId: nftDetails.itemId,
                  nftAddress: nftDetails.collectionAddress,
                  nftType: nftDetails.collectionType,
                }
              : undefined,
          tokenInfo:
            !isNFT && tokenDetails
              ? {
                  tokenIdOnNetwork: tokenDetails.info.address,
                }
              : undefined,
        },
      ];
      let unsignedTx = await serviceSend.buildUnsignedTx({
        networkId,
        accountId,
        transfersInfo,
      });

      const isNonceRequired = await serviceSend.getIsNonceRequired({
        networkId,
      });

      if (isNonceRequired) {
        const nonce = await serviceSend.getNextNonce({
          networkId,
          accountAddress: account.address,
        });
        unsignedTx = await serviceSend.updateUnsignedTx({
          networkId,
          accountId,
          unsignedTx,
          nonceInfo: { nonce },
        });
      }
      setIsSubmitting(false);

      navigation.push(EModalSendRoutes.SendConfirm, {
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
      });
    } catch (e: any) {
      setIsSubmitting(false);

      throw new OneKeyError({
        info: e.message ?? e,
        autoToast: true,
      });
    }
  }, [
    accountId,
    amount,
    getAccount,
    isNFT,
    isValidName,
    navigation,
    networkId,
    nftDetails,
    resolvedAddress,
    serviceSend,
    toAddress,
    tokenDetails,
  ]);
  const handleValidateTokenAmount = useCallback(
    (value: string) => {
      const tokenInfo = tokenDetails;
      const amountBN = new BigNumber(value ?? 0);
      if (isUseFiat) {
        if (amountBN.isGreaterThan(tokenInfo?.fiatValue ?? 0)) {
          return false;
        }
      } else if (amountBN.isGreaterThan(tokenInfo?.balanceParsed ?? 0)) {
        return false;
      }

      return true;
    },
    [isUseFiat, tokenDetails],
  );
  const handleOnNameResolverStateChange = useCallback(
    (state: INameResolverState) => {
      onNameResolverChange(state);
      void form.trigger('to');
    },
    [form, onNameResolverChange],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isLoadingToken || isLoadingNFT || isSubmitting || isSearchingName)
      return true;

    if (isValidName && resolvedAddress) return false;

    if (!form.formState.isValid || !toAddress || !amount) {
      return true;
    }
  }, [
    amount,
    form.formState.isValid,
    isLoadingNFT,
    isLoadingToken,
    isSearchingName,
    isSubmitting,
    isValidName,
    resolvedAddress,
    toAddress,
  ]);

  const renderTokenDataInputForm = useCallback(() => {
    const tokenInfo = tokenDetails;
    return (
      <Form.Field
        name="amount"
        label={intl.formatMessage({ id: 'form__amount' })}
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
            if (!isUseFiat && dp && dp > (tokenInfo?.info.decimals ?? 0)) {
              form.setValue(
                'amount',
                valueBN.toFixed(tokenInfo?.info.decimals ?? 0),
              );
            }
          },
        }}
        description={
          <XStack pt="$1.5" alignItems="center">
            <SizableText size="$bodyLg" color="$textSubdued" pr="$1">
              ≈
              {isUseFiat
                ? `${linkedAmount} ${tokenSymbol}`
                : `${currencySymbol}${linkedAmount}`}
            </SizableText>
            <IconButton
              title={
                isUseFiat ? 'Enter amount as token' : 'Enter amount as fiat'
              }
              icon="SwitchVerOutline"
              size="small"
              iconProps={{
                size: '$4',
              }}
              onPress={handleOnChangeAmountMode}
            />
          </XStack>
        }
      >
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          position="absolute"
          right="$0"
          top="$0"
        >
          {intl.formatMessage(
            { id: 'content__balance_str' },
            {
              0: isUseFiat
                ? `${currencySymbol}${tokenInfo?.fiatValue ?? 0}`
                : `${tokenInfo?.balanceParsed ?? 0} ${tokenSymbol}`,
            },
          )}
        </SizableText>

        <Input
          size="large"
          inputMode="decimal"
          placeholder={intl.formatMessage({ id: 'action__enter_amount' })}
          addOns={[
            {
              label: intl.formatMessage({ id: 'action__max' }),
              onPress: handleOnSendMax,
            },
          ]}
        />
      </Form.Field>
    );
  }, [
    currencySymbol,
    form,
    handleOnChangeAmountMode,
    handleOnSendMax,
    handleValidateTokenAmount,
    intl,
    isUseFiat,
    linkedAmount,
    tokenDetails,
    tokenSymbol,
  ]);
  const renderNFTDataInputForm = useCallback(() => {
    if (nft?.collectionType === ENFTType.ERC1155) {
      return (
        <Form.Field
          name="nftAmount"
          label={intl.formatMessage({ id: 'form__amount' })}
          rules={{ required: true }}
        >
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            position="absolute"
            right="$0"
            top="$0"
          >
            Available: 9999
          </SizableText>
          <Input
            size="large"
            placeholder={intl.formatMessage({ id: 'action__enter_amount' })}
            addOns={[
              {
                label: intl.formatMessage({ id: 'action__max' }),
                onPress: () => console.log('clicked'),
              },
            ]}
          />
        </Form.Field>
      );
    }
    return null;
  }, [intl, nft?.collectionType]);

  return (
    <Page>
      <Page.Header title="Send" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: 'form__token' })}
            name="token"
          >
            <ListItem
              avatarProps={{
                src: isNFT ? nft?.metadata?.image : token?.logoURI,
              }}
              mx="$0"
              borderWidth={1}
              borderColor="$border"
              title={isNFT ? nft?.metadata?.name : token?.name}
              subtitle={network?.name}
              onPress={isNFT ? undefined : handleOnSelectToken}
            >
              {!isNFT && <Icon name="SwitchHorOutline" color="$iconSubdued" />}
            </ListItem>
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({ id: 'form__to_uppercase' })}
            name="to"
            rules={{ required: true }}
          >
            <XStack space="$4" position="absolute" right="$0" top="$0">
              <IconButton
                title={intl.formatMessage({ id: 'title__address_book' })}
                icon="Notebook1Outline"
                size="small"
                variant="tertiary"
              />
              <IconButton
                title={intl.formatMessage({ id: 'action__scan' })}
                icon="ScanOutline"
                size="small"
                variant="tertiary"
              />
            </XStack>
            <YStack space="$4">
              <Input
                size="large"
                placeholder={intl.formatMessage({
                  id: 'form__address_and_domain_placeholder',
                })}
              />
              <NameResolver
                nameToResolve={nameToResolve}
                networkId={networkId}
                onChange={handleOnNameResolverStateChange}
              />
            </YStack>
          </Form.Field>
          {isNFT ? renderNFTDataInputForm() : renderTokenDataInputForm()}
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirm={handleOnConfirm}
        onConfirmText={intl.formatMessage({ id: 'action__next' })}
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: isSubmitting,
        }}
      />
    </Page>
  );
}

export { SendDataInputContainer };
