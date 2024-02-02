/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  Page,
  SizableText,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/common/components/AddressInput';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getFormattedNumber } from '@onekeyhq/kit/src/utils/format';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError, OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import AmountInput from '../../components/AmountInput';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendDataInputContainer() {
  const intl = useIntl();

  const [isUseFiat, setIsUseFiat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendDataInput>>();

  const {
    serviceNFT,
    serviceSend,
    serviceAccount,
    serviceToken,
    serviceNetwork,
  } = backgroundApiProxy;

  const { networkId, accountId, isNFT, token, nfts } = route.params;
  const nft = nfts?.[0];

  const {
    result: [network, tokenDetails, nftDetails] = [],
    isLoading: isLoadingAssets,
  } = usePromiseResult(
    async () => {
      if (!token && !nft) {
        throw new OneKeyInternalError('token and nft info are both missing.');
      }
      const r = await Promise.all([
        serviceAccount.getAccount({
          accountId,
          networkId,
        }),
        serviceNetwork.getNetwork({ networkId }),
      ]);

      let nftResp: IAccountNFT[] | undefined;
      let tokenResp:
        | ({
            info: IToken;
          } & ITokenFiat)[]
        | undefined;

      if (isNFT && nft) {
        nftResp = await serviceNFT.fetchNFTDetails({
          networkId,
          accountAddress: r[0].address,
          params: [
            {
              collectionAddress: nft.collectionAddress,
              itemId: nft.itemId,
            },
          ],
        });
      } else if (!isNFT && token) {
        tokenResp = await serviceToken.fetchTokensDetails({
          networkId,
          accountAddress: r[0].address,
          contractList: [token.address],
        });
      }

      return [r[1], tokenResp?.[0], nftResp?.[0]];
    },
    [
      accountId,
      isNFT,
      networkId,
      nft,
      serviceAccount,
      serviceNFT,
      serviceNetwork,
      serviceToken,
      token,
    ],
    { watchLoading: true },
  );

  const currencySymbol = settings.currencyInfo.symbol;
  const tokenSymbol = tokenDetails?.info.symbol ?? '';

  const form = useForm({
    defaultValues: {
      to: { raw: '' } as IAddressInputValue,
      amount: '',
      nftAmount: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  // token amount or fiat amount
  const amount = form.watch('amount');
  const toPending = form.watch('to.pending');

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

  const handleOnChangeAmountMode = useCallback(() => {
    setIsUseFiat((prev) => !prev);
    form.setValue('amount', linkedAmount);
  }, [form, linkedAmount]);
  const handleOnSelectToken = useCallback(() => navigation.pop(), [navigation]);
  const handleOnChangeAmountPercent = useCallback(
    (percent: number) => {
      form.setValue(
        'amount',
        new BigNumber(
          (isUseFiat ? tokenDetails?.fiatValue : tokenDetails?.balanceParsed) ??
            0,
        )
          .times(percent)
          .toFixed(),
      );
      void form.trigger('amount');
    },
    [form, isUseFiat, tokenDetails?.balanceParsed, tokenDetails?.fiatValue],
  );
  const handleOnConfirm = useCallback(async () => {
    try {
      const toAddress = form.getValues('to').resolved;
      if (!toAddress) return;

      setIsSubmitting(true);

      let realAmount = amount;

      if (isUseFiat) {
        if (new BigNumber(amount).isGreaterThan(tokenDetails?.fiatValue ?? 0)) {
          realAmount = tokenDetails?.balanceParsed ?? '0';
        } else {
          realAmount = linkedAmount;
        }
      }

      const account = await serviceAccount.getAccount({ networkId, accountId });

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
        },
      ];
      let unsignedTx = await serviceSend.buildUnsignedTx({
        networkId,
        accountId,
        transfersInfo,
      });

      const isNonceRequired = (
        await serviceNetwork.getNetworkSettings({
          networkId,
        })
      ).nonceRequired;

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
    form,
    isNFT,
    isUseFiat,
    linkedAmount,
    navigation,
    networkId,
    nftDetails,
    serviceAccount,
    serviceNetwork,
    serviceSend,
    tokenDetails,
  ]);
  const handleValidateTokenAmount = useCallback(
    (value: string) => {
      const tokenInfo = tokenDetails;
      const amountBN = new BigNumber(value ?? 0);
      let isInsufficientBalance = false;
      if (isUseFiat) {
        if (amountBN.isGreaterThan(tokenInfo?.fiatValue ?? 0)) {
          isInsufficientBalance = true;
        }
      } else if (amountBN.isGreaterThan(tokenInfo?.balanceParsed ?? 0)) {
        isInsufficientBalance = true;
      }

      if (isInsufficientBalance)
        return intl.formatMessage({ id: 'msg__insufficient_balance' });

      return true;
    },
    [intl, isUseFiat, tokenDetails],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isLoadingAssets || isSubmitting || toPending) return true;

    if (!form.formState.isValid) {
      return true;
    }

    if ((!isNFT || nft?.collectionType === ENFTType.ERC1155) && !amount) {
      return true;
    }
  }, [
    amount,
    form.formState.isValid,
    isLoadingAssets,
    isNFT,
    isSubmitting,
    nft?.collectionType,
    toPending,
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
      >
        {/* <SizableText
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
        </SizableText> */}

        <AmountInput
          isUseFiat={isUseFiat}
          linkedAmount={linkedAmount}
          tokenSymbol={tokenSymbol}
          currencySymbol={currencySymbol}
          onChangePercent={handleOnChangeAmountPercent}
          onChangeAmountMode={handleOnChangeAmountMode}
        />
      </Form.Field>
    );
  }, [
    currencySymbol,
    form,
    handleOnChangeAmountMode,
    handleOnChangeAmountPercent,
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
    <Page scrollEnabled>
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
                borderRadius: '$full',
                cornerImageProps: {
                  src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
                },
              }}
              mx="$0"
              borderWidth={1}
              borderColor="$border"
              // title={isNFT ? nft?.metadata?.name : token?.name}
              // subtitle={network?.name}
              onPress={isNFT ? undefined : handleOnSelectToken}
              borderRadius="$2"
            >
              <ListItem.Text
                flex={1}
                primary={isNFT ? nft?.metadata?.name : token?.symbol}
                secondary={
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {token?.name}
                  </SizableText>
                }
              />
              {!isNFT && (
                <Icon name="ChevronGrabberVerOutline" color="$iconSubdued" />
              )}
            </ListItem>
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({ id: 'content__to' })}
            name="to"
            rules={{
              required: true,
              validate: (value: IAddressInputValue) => {
                if (value.pending) {
                  return;
                }
                if (!value.resolved) {
                  return intl.formatMessage({ id: 'form__address_invalid' });
                }
              },
            }}
          >
            <AddressInput networkId={networkId} />
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
