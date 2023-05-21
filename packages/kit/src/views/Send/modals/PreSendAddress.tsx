import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Form, Token, Typography, useForm } from '@onekeyhq/components';
import type { GoPlusAddressSecurity } from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  INFTInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../components/AddressInput';
import NameServiceResolver, {
  useNameServiceStatus,
} from '../../../components/NameServiceResolver';
import { useActiveSideAccount } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { BulkSenderTypeEnum } from '../../BulkSender/types';
import { GoPlusSecurityItems } from '../../ManageTokens/components/GoPlusAlertItems';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendModalRoutes } from '../types';

import type { ModalScreenProps } from '../../../routes/types';
import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendAddress>;

type FormValues = {
  to: string;
  destinationTag?: string;
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
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const route = useRoute<RouteProps>();
  const [securityItems, setSecurityItems] = useState<
    (keyof GoPlusAddressSecurity)[]
  >([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [displayDestinationTag, setDisplayDestinationTag] = useState(false);
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
  const { token: tokenInfo } = useSingleToken(
    networkId,
    transferInfo.token ?? '',
  );

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

  const [validateMessage, setvalidateMessage] = useState({
    warningMessage: '',
    successMessage: '',
    errorMessage: '',
  });

  const submitDisabled =
    isLoading ||
    !formValues?.to ||
    !isValid ||
    formState.isValidating ||
    disableSubmitBtn ||
    isValidatingAddress ||
    validateMessage.errorMessage.length > 0;

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

  useEffect(() => {
    (async () => {
      const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
        networkId,
      );
      setDisplayDestinationTag(vaultSettings?.withDestinationTag ?? false);
    })();
  }, [networkId]);

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
            screen: SendModalRoutes.BatchSendConfirm,
            params: {
              networkId,
              accountId,
              feeInfoUseFeeInTx: false,
              feeInfoEditable: true,
              encodedTxs: [...encodedApproveTxs, encodedTx],
              backRouteName: SendModalRoutes.PreSendAddress,
              payloadInfo: {
                type: 'Transfer',
                nftInfos,
              },
              transferCount: transferInfos.length,
              transferType: BulkSenderTypeEnum.NFT,
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
            screen: SendModalRoutes.SendConfirm,
            params: {
              ...transferInfo,
              networkId,
              accountId,
              encodedTx,
              feeInfoUseFeeInTx: false,
              feeInfoEditable: true,
              backRouteName: SendModalRoutes.PreSendAddress,
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
            screen: SendModalRoutes.PreSendAmount,
            params: {
              ...transferInfo,
              networkId,
              accountId,
              to: toVal,
              destinationTag: values.destinationTag,
            },
          },
        });
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedAddress, isLoading, nftSendConfirm, navigation, transferInfo],
  );
  const doSubmit = handleSubmit(onSubmit);

  const DestinationTagForm = useMemo(() => {
    // if (networkId !== 'xrp--0') return null;
    if (!displayDestinationTag) return null;

    return (
      <Form.Item
        control={control}
        name="destinationTag"
        rules={{
          maxLength: {
            value: 10,
            message: intl.formatMessage({
              id: 'msg__exceeding_the_maximum_word_limit',
            }),
          },
          validate: (value) => {
            if (!value) return undefined;
            const result = !/^[0-9]+$/.test(value);
            return result
              ? intl.formatMessage({
                  id: 'form__enter_a_number_greater_than_or_equal_to_0',
                })
              : undefined;
          },
        }}
      >
        <Form.Input
          type="number"
          placeholder={intl.formatMessage({
            id: 'form__destination_tag_placeholder',
          })}
        />
      </Form.Item>
    );
  }, [control, displayDestinationTag, intl]);

  const helpTextOfNameServiceResolver = useCallback(
    (value) => (
      <NameServiceResolver
        name={value}
        onChange={syncStateAndReTriggerValidate}
        disableBTC={false}
        networkId={networkId}
      />
    ),
    [networkId, syncStateAndReTriggerValidate],
  );

  const validateHandle = useCallback(
    (value: string) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(async () => {
        const toAddress = resolvedAddress || value || '';
        setvalidateMessage({
          warningMessage: '',
          errorMessage: '',
          successMessage: '',
        });
        if (!toAddress) {
          return undefined;
          // return intl.formatMessage({
          //   id: 'form__address_invalid',
          // });
        }
        try {
          setIsValidatingAddress(true);
          await backgroundApiProxy.validator.validateAddress(
            networkId,
            toAddress,
          );
          await backgroundApiProxy.validator.validatePreSendAddress({
            address: toAddress,
            networkId,
            accountId,
          });
        } catch (error0: any) {
          setIsValidatingAddress(false);
          if (isValidNameServiceName && !resolvedAddress) return undefined;
          const { key, info } = error0;
          if (key) {
            setvalidateMessage({
              warningMessage: '',
              successMessage: '',
              errorMessage: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            });
            return false;
          }
          setvalidateMessage({
            warningMessage: '',
            successMessage: '',
            errorMessage: intl.formatMessage({
              id: 'form__address_invalid',
            }),
          });
          return false;
        }
        const isContractAddress = await isContractAddressCheck(toAddress);
        if (isContractAddress) {
          setvalidateMessage({
            warningMessage: intl.formatMessage({
              id: 'msg__the_recipient_address_is_a_contract_address',
            }),
            successMessage: '',
            errorMessage: '',
          });
        } else {
          const addressbookItem =
            await backgroundApiProxy.serviceAddressbook.getItem({
              address: toAddress,
            });
          if (addressbookItem) {
            setvalidateMessage({
              warningMessage: '',
              successMessage: `${intl.formatMessage({
                id: 'title__address_book',
              })}:${addressbookItem.name}`,
              errorMessage: '',
            });
          } else {
            setvalidateMessage({
              warningMessage: '',
              successMessage: intl.formatMessage({
                id: 'form__enter_recipient_address_valid',
              }),
              errorMessage: '',
            });
          }
        }
        setIsValidatingAddress(false);
        return true;
      }, 100);
    },
    [
      accountId,
      intl,
      isContractAddressCheck,
      isValidNameServiceName,
      networkId,
      resolvedAddress,
    ],
  );

  // Refersh pending tx status before entering the send confirm modal
  // To avoid pending tx alert on send confirm modal (actually there isn't)
  useEffect(() => {
    const refreshPendingTx = async () => {
      const pendingTxs =
        await backgroundApiProxy.serviceHistory.getLocalHistory({
          networkId,
          accountId,
          isPending: true,
          limit: 1,
        });
      if (pendingTxs.length > 0) {
        backgroundApiProxy.serviceHistory.refreshHistory({
          networkId,
          accountId,
        });
      }
    };

    refreshPendingTx();
  }, [accountId, networkId]);

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
                warningMessage={validateMessage.warningMessage}
                successMessage={validateMessage.successMessage}
                errorMessage={validateMessage.errorMessage}
                isValidating={isValidatingAddress}
                name="to"
                formControlProps={{ width: 'full' }}
                helpText={helpTextOfNameServiceResolver}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  // @ts-expect-error
                  validate: validateHandle,
                }}
                defaultValue=""
              >
                <AddressInput
                  // TODO different max length in network
                  maxLength={103}
                  networkId={networkId}
                  // numberOfLines={10}
                  h={{ base: 120, md: 120 }}
                  plugins={['contact', 'paste', 'scan']}
                />
              </Form.Item>
              {DestinationTagForm}
            </Form>
            <GoPlusSecurityItems items={securityItems} />
          </Box>
        ),
      }}
    />
  );
}

export { PreSendAddress };
