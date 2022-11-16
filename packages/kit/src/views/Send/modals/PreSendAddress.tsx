import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Form,
  HStack,
  Token,
  Typography,
  useForm,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  GoPlusAddressSecurity,
  GoPlusSupportApis,
} from '@onekeyhq/engine/src/types/goplus';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { makeTimeoutPromise } from '../../../background/utils';
import AddressInput from '../../../components/AddressInput';
import NameServiceResolver, {
  useNameServiceStatus,
} from '../../../components/NameServiceResolver';
import { useActiveSideAccount } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { useTokenInfo } from '../../../hooks/useTokenInfo';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendAddress
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendAddress>;

type FormValues = {
  to: string;
};

// @ts-ignore
const localeMaps: Record<keyof GoPlusAddressSecurity, LocaleIds> = {
  'honeypot_related_address': 'badge__honeypot_related',
  'phishing_activities': 'badge__phishing',
  'blackmail_activities': 'badge__blackmail',
  'stealing_attack': 'badge__stealing_attack',
  'fake_kyc': 'badge__fake_kyc',
  'malicious_mining_activities': 'badge__malicious_mining',
  'darkweb_transactions': 'badge__darkweb_txns',
  'cybercrime': 'badge__cybercrime',
  'money_laundering': 'badge__money_laudering',
  'financial_crime': 'badge__financial_crime',
  'blacklist_doubt': 'badge__blacklist_doubt',
};

function NFTView({ asset }: { asset?: NFTAsset }) {
  if (asset) {
    return (
      <Box flexDirection="row" alignItems="center">
        <NFTListImage asset={asset} borderRadius="6px" size={40} />
        <Typography.Body1Strong ml={3} numberOfLines={2} flex={1}>
          {asset.name ?? asset.contractName}
        </Typography.Body1Strong>
      </Box>
    );
  }
  return <Box size="40px" />;
}

const GoPlusSecurityItems: FC<{ items: (keyof GoPlusAddressSecurity)[] }> = ({
  items,
}) => {
  const intl = useIntl();
  return (
    <HStack mt="2" w="full" flexWrap="wrap">
      {items.map((item) => (
        <Box
          bg="surface-critical-subdued"
          px="2"
          py="2px"
          mr="2"
          borderRadius="6px"
          mb="2"
        >
          <Typography.Body2Strong key={item} color="text-critical">
            {intl.formatMessage({ id: localeMaps[item] })}
          </Typography.Body2Strong>
        </Box>
      ))}
    </HStack>
  );
};

function PreSendAddress() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const [securityItems, setSecurityItems] = useState<
    (keyof GoPlusAddressSecurity)[]
  >([]);
  const { serviceNFT, engine } = backgroundApiProxy;
  const transferInfo = useMemo(() => ({ ...route.params }), [route.params]);
  const { isNFT } = transferInfo;
  const { networkId, account, accountId, network } =
    useActiveSideAccount(transferInfo);
  const useFormReturn = useForm<FormValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      to: transferInfo.to || '',
    },
  });
  const { isLoading, formValues, isValid } =
    useFormOnChangeDebounced<FormValues>({
      useFormReturn,
    });

  const {
    onChange: onNameServiceChange,
    disableSubmitBtn,
    isValid: isValidNameServiceName,
    address: resolvedAddress,
  } = useNameServiceStatus();

  const { control, formState, trigger, handleSubmit } = useFormReturn;
  const navigation = useNavigation<NavigationProps>();
  const tokenInfo = useTokenInfo({
    networkId,
    tokenIdOnNetwork: transferInfo.token,
  });

  const [nftInfo, updateNFTInfo] = useState<NFTAsset>();
  useEffect(() => {
    (async () => {
      if (isNFT) {
        const { tokenId } = transferInfo;
        if (tokenId) {
          const contractAddress = transferInfo.token;
          const asset = await serviceNFT.getAsset({
            accountId: account?.address ?? '',
            networkId,
            contractAddress,
            tokenId,
            local: true,
          });
          updateNFTInfo(asset);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferInfo.tokenId, transferInfo.token]);

  const submitDisabled =
    isLoading ||
    !formValues?.to ||
    !isValid ||
    formState.isValidating ||
    disableSubmitBtn;

  const [warningMessage, setWarningMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchSecurityInfo = useCallback(async () => {
    if (submitDisabled) {
      return;
    }
    const address = resolvedAddress || formValues.to;
    if (!isValid || !networkId || !address) {
      return;
    }
    try {
      const addressSecurity =
        await backgroundApiProxy.serviceToken.getAddressRiskyItems({
          address,
          networkId,
          apiName: GoPlusSupportApis.address_security,
        });
      console.log(addressSecurity);
      setSecurityItems(addressSecurity);
    } catch (error) {
      console.log(error);
    }
  }, [networkId, isValid, formValues, resolvedAddress, submitDisabled]);

  useEffect(() => {
    fetchSecurityInfo();
  }, [fetchSecurityInfo]);

  const isContractAddressCheck = useCallback(
    (address: string) =>
      makeTimeoutPromise({
        asyncFunc: async () => {
          const isContractAddress =
            await backgroundApiProxy.validator.isContractAddress(
              networkId,
              address,
            );

          return isContractAddress;
        },
        timeout: 600,
        timeoutResult: false,
      }),
    [networkId],
  );

  const syncStateAndReTriggerValidate = useCallback(
    (val) => {
      onNameServiceChange(val);
      trigger('to');
    },
    [trigger, onNameServiceChange],
  );

  const nftSendConfirm = useCallback(
    async (toVal: string) => {
      if (!account || !network || !nftInfo) {
        return;
      }
      if (transferInfo) {
        transferInfo.from = account.address;
        transferInfo.to = toVal;
      }
      const { closeModal, ...info } = transferInfo;
      const encodedTx = await engine.buildEncodedTxFromTransfer({
        networkId,
        accountId,
        transferInfo: info,
      });
      navigation.navigate(SendRoutes.SendConfirm, {
        ...transferInfo,
        networkId,
        accountId,
        encodedTx,
        feeInfoUseFeeInTx: false,
        feeInfoEditable: true,
        backRouteName: SendRoutes.PreSendAddress,
        payloadInfo: {
          type: 'Transfer',
          nftInfo: {
            asset: nftInfo,
            amount: transferInfo.amount,
            from: account.address,
            to: toVal,
          },
        },
        onModalClose: closeModal,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, nftInfo, transferInfo],
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      const toVal = resolvedAddress || values.to;
      if (isLoading || !toVal) {
        return;
      }
      if (isNFT) {
        nftSendConfirm(toVal);
      } else {
        navigation.navigate(SendRoutes.PreSendAmount, {
          ...transferInfo,
          networkId,
          accountId,
          to: toVal,
        });
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedAddress, isLoading, nftSendConfirm, navigation, transferInfo],
  );
  const doSubmit = handleSubmit(onSubmit);

  return (
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      height="auto"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__send_to' })}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: submitDisabled,
      }}
      onPrimaryActionPress={() => doSubmit()}
      scrollViewProps={{
        children: (
          <Box>
            <Form>
              {isNFT ? (
                <NFTView asset={nftInfo} />
              ) : (
                <Box flexDirection="row" alignItems="center">
                  <Token size={8} token={tokenInfo} />
                  <Typography.Body1Strong ml={3}>
                    {tokenInfo?.symbol}
                  </Typography.Body1Strong>
                </Box>
              )}
              <Form.Item
                control={control}
                warningMessage={warningMessage}
                successMessage={successMessage}
                name="to"
                formControlProps={{ width: 'full' }}
                helpText={(value) => (
                  <NameServiceResolver
                    name={value}
                    onChange={syncStateAndReTriggerValidate}
                    disableBTC={false}
                    networkId={networkId}
                  />
                )}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (value: string) => {
                    const toAddress = resolvedAddress || value || '';
                    setSuccessMessage('');
                    setWarningMessage('');
                    if (!toAddress) {
                      return undefined;
                      // return intl.formatMessage({
                      //   id: 'form__address_invalid',
                      // });
                    }
                    try {
                      await backgroundApiProxy.validator.validateAddress(
                        networkId,
                        toAddress,
                      );
                      await backgroundApiProxy.validator.validatePreSendAddress(
                        {
                          address: toAddress,
                          networkId,
                          accountId,
                        },
                      );
                    } catch (error0: any) {
                      if (isValidNameServiceName && !resolvedAddress)
                        return undefined;

                      const { key, info } = error0;
                      if (key) {
                        return intl.formatMessage(
                          {
                            id: key,
                          },
                          info ?? {},
                        );
                      }
                      return intl.formatMessage({
                        id: 'form__address_invalid',
                      });
                    }
                    const isContractAddress = await isContractAddressCheck(
                      toAddress,
                    );
                    if (isContractAddress) {
                      setWarningMessage(
                        intl.formatMessage({
                          id: 'msg__the_recipient_address_is_a_contract_address',
                        }),
                      );
                      setSuccessMessage('');
                    } else {
                      setWarningMessage('');
                      setSuccessMessage(
                        intl.formatMessage({
                          id: 'form__enter_recipient_address_valid',
                        }),
                      );
                    }
                    return true;
                  },
                }}
                defaultValue=""
              >
                <AddressInput
                  // TODO different max length in network
                  maxLength={80}
                  networkId={networkId}
                  // numberOfLines={10}
                  h={{ base: 120, md: 120 }}
                  plugins={['contact', 'paste', 'scan']}
                />
              </Form.Item>
            </Form>
            <Box
              height={
                warningMessage?.length > 0 ||
                successMessage?.length > 0 ||
                // @ts-ignore
                formState?.errors?.to?.message?.length > 0
                  ? 0
                  : '28px'
              }
            />
            <GoPlusSecurityItems items={securityItems} />
          </Box>
        ),
      }}
    />
  );
}

export { PreSendAddress };
