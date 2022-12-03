import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Form, Token, Typography, useForm } from '@onekeyhq/components';
import {
  GoPlusAddressSecurity,
  GoPlusSupportApis,
} from '@onekeyhq/engine/src/types/goplus';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  INFTInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { makeTimeoutPromise } from '../../../background/utils';
import AddressInput from '../../../components/AddressInput';
import NameServiceResolver, {
  useNameServiceStatus,
} from '../../../components/NameServiceResolver';
import { useActiveSideAccount } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { useTokenInfo } from '../../../hooks/useTokenInfo';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '../../../routes/types';
import { GoPlusSecurityItems } from '../../ManageTokens/components/GoPlusAlertItems';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from '../types';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendAddress>;

type FormValues = {
  to: string;
};

function NFTView({ asset, total }: { asset?: NFTAsset; total: number }) {
  const intl = useIntl();

  if (asset) {
    return (
      <Box flexDirection="row" alignItems="center">
        <NFTListImage asset={asset} borderRadius="6px" size={40} />
        <Typography.Body1Strong ml={3} numberOfLines={2} flex={1}>
          {total === 1 && (asset.name ?? asset.contractName)}

          {total > 1 &&
            intl.formatMessage(
              {
                id: 'content__str_and_others_int_nfts',
              },
              {
                firstNFT: asset.name ?? asset.contractName,
                otherNFTs: total - 1,
              },
            )}
        </Typography.Body1Strong>
      </Box>
    );
  }
  return <Box size="40px" />;
}

function PreSendAddress() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const [securityItems, setSecurityItems] = useState<
    (keyof GoPlusAddressSecurity)[]
  >([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const { serviceNFT, serviceBatchTransfer, engine } = backgroundApiProxy;
  const routeParams = useMemo(() => ({ ...route.params }), [route.params]);
  const { transferInfos, accountId, networkId, closeModal, ...reset } =
    routeParams;
  const transferInfo =
    transferInfos && transferInfos.length > 0
      ? transferInfos[0]
      : (reset as ITransferInfo);
  const { isNFT } = transferInfo;
  const { account, network } = useActiveSideAccount(routeParams);
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
  const navigation = useNavigation<NavigationProps['navigation']>();
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
    const addressSecurity =
      await backgroundApiProxy.serviceToken.getAddressRiskyItems({
        address,
        networkId,
        apiName: GoPlusSupportApis.address_security,
      });
    setSecurityItems(addressSecurity);
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

      const nftInfos: INFTInfo[] = [];

      let encodedTx = null;
      let prevNonce;

      if (transferInfo) {
        transferInfo.from = account.address;
        transferInfo.to = toVal;
      }

      if (transferInfos && transferInfos.length > 1) {
        setIsLoadingAssets(true);
        const encodedApproveTxs =
          await serviceBatchTransfer.buildEncodedTxsFromBatchApprove({
            networkId,
            accountId,
            transferInfos,
          });

        const prevTx = encodedApproveTxs[encodedApproveTxs.length - 1];

        if (prevTx) {
          prevNonce = (prevTx as IEncodedTxEvm).nonce;
          prevNonce =
            prevNonce !== undefined
              ? new BigNumber(prevNonce).toNumber()
              : prevNonce;
        }

        encodedTx = await serviceBatchTransfer.buildEncodedTxFromBatchTransfer({
          networkId,
          accountId,
          transferInfos,
          prevNonce,
        });

        for (let i = 0; i < transferInfos.length; i += 1) {
          const asset = await serviceNFT.getAsset({
            accountId: account?.address ?? '',
            networkId,
            contractAddress: transferInfos[i].token,
            tokenId: transferInfos[i].tokenId ?? '',
            local: true,
          });
          nftInfos.push({
            asset: asset || ({} as NFTAsset),
            amount: transferInfo.amount,
            from: account.address,
            to: toVal,
          });
        }
        setIsLoadingAssets(false);

        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendRoutes.BatchSendConfirm,
            params: {
              networkId,
              accountId,
              feeInfoUseFeeInTx: false,
              feeInfoEditable: true,
              encodedTxs: [...encodedApproveTxs, encodedTx],
              backRouteName: SendRoutes.PreSendAddress,
              payloadInfo: {
                type: 'Transfer',
                nftInfos,
              },
              transferCount: transferInfos.length,
              onModalClose: closeModal,
            },
          },
        });
      } else {
        encodedTx = await engine.buildEncodedTxFromTransfer({
          networkId,
          accountId,
          transferInfo,
        });
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendRoutes.SendConfirm,
            params: {
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
            },
          },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, nftInfo, transferInfo, transferInfos, closeModal],
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
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendRoutes.PreSendAmount,
            params: {
              ...transferInfo,
              networkId,
              accountId,
              to: toVal,
            },
          },
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
        isLoading: isLoadingAssets,
      }}
      onPrimaryActionPress={() => doSubmit()}
      scrollViewProps={{
        children: (
          <Box>
            <Form>
              {isNFT ? (
                <NFTView asset={nftInfo} total={transferInfos?.length || 1} />
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
