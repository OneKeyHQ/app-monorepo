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
import { ENFTType } from '@onekeyhq/shared/types/nft';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';
import { checkIsDomain } from '@onekeyhq/shared/src/utils/uriUtils';

function SendDataInputContainer() {
  const intl = useIntl();

  const [isUseFiat, setIsUseFiat] = useState(false);
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

  const { networkId, accountId, isNFT, token, nfts } = route.params;
  const nft = nfts?.[0];

  const getAccount = useCallback(
    async () =>
      backgroundApiProxy.serviceAccount.getAccountOfWallet({
        accountId,
        indexedAccountId: '',
        networkId,
        deriveType: 'default',
      }),
    [accountId, networkId],
  );

  const network = usePromiseResult(
    () => mockGetNetwork({ networkId }),
    [networkId],
  ).result;

  const nftResult = usePromiseResult(
    async () => {
      if (!isNFT) return;
      const account = await getAccount();
      const r = await backgroundApiProxy.serviceNFT.fetchNFTDetails({
        networkId,
        accountAddress: account.address,
        collectionAddress: nft?.collectionAddress ?? '',
        itemId: nft?.itemId ?? '',
      });
      return r;
    },
    [getAccount, isNFT, networkId, nft?.collectionAddress, nft?.itemId],
    { watchLoading: true },
  );

  const tokenResult = usePromiseResult(
    async () => {
      if (isNFT) return;
      const account = await getAccount();
      const r = await backgroundApiProxy.serviceToken.fetchTokenDetail({
        networkId,
        accountAddress: account.address,
        address: token?.address ?? '',
        isNative: token?.isNative ?? false,
      });
      return r;
    },
    [getAccount, isNFT, networkId, token?.address, token?.isNative],
    { watchLoading: true },
  );

  const currencySymbol = settings.currencyInfo.symbol;
  const tokenSymbol = tokenResult.result?.info.symbol ?? '';

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

    const tokenPrice = tokenResult.result?.price;

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
  }, [amount, isUseFiat, tokenResult.result?.price]);

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
      form.setValue('amount', tokenResult.result?.fiatValue ?? '0');
    } else {
      form.setValue('amount', tokenResult.result?.balanceParsed ?? '0');
    }
    void form.trigger('amount');
  }, [
    form,
    isUseFiat,
    tokenResult.result?.balanceParsed,
    tokenResult.result?.fiatValue,
  ]);
  const handleOnConfirm = useCallback(async () => {
    // TODO: handleOnConfirm
    // const account = await getAccount();
    // const transfersInfo: ITransferInfo[] = [
    //   {
    //     from: account.address,
    //     to: isValidName ? resolvedAddress : toAddress,
    //     amount,
    //     token: tokenResult.result?.info.address ?? '',
    //   },
    // ];
    // const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
    //   networkId,
    //   accountId,
    //   transfersInfo,
    // });
    // navigation.push(EModalSendRoutes.SendConfirm, {
    //   accountId,
    //   networkId,
    //   unsignedTxs: [unsignedTx],
    //   transfersInfo,
    // });
  }, []);
  const handleValidateTokenAmount = useCallback(
    (value: string) => {
      const tokenInfo = tokenResult.result;
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
    [isUseFiat, tokenResult.result],
  );
  const handleOnNameResolverStateChange = useCallback(
    (state: INameResolverState) => {
      onNameResolverChange(state);
      void form.trigger('to');
    },
    [form, onNameResolverChange],
  );

  const isSubmitDisabled = useMemo(() => {
    if (tokenResult.isLoading || nftResult.isLoading || isSearchingName)
      return true;

    if (!form.formState.isValid || !toAddress || !amount) {
      return true;
    }
  }, [
    amount,
    form.formState.isValid,
    isSearchingName,
    nftResult.isLoading,
    toAddress,
    tokenResult.isLoading,
  ]);

  const renderTokenDataInputForm = useCallback(() => {
    const tokenInfo = tokenResult.result;
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
    tokenResult.result,
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
                src: isNFT ? nft?.metadata.image : token?.logoURI,
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
        confirmButtonProps={{ disabled: isSubmitDisabled }}
      />
    </Page>
  );
}

export { SendDataInputContainer };
