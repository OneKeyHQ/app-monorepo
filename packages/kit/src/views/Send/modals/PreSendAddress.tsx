import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Form,
  ToastManager,
  Token,
  Typography,
  useForm,
} from '@onekeyhq/components';
import type { OneKeyError } from '@onekeyhq/engine/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { GoPlusAddressSecurity } from '@onekeyhq/engine/src/types/goplus';
import { GoPlusSupportApis } from '@onekeyhq/engine/src/types/goplus';
import type { INFTAsset, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { findLnurl } from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';
import type {
  INFTInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import {
  addHexPrefix,
  isHexString,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { isLightningNetworkByImpl } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../components/AddressInput';
import { AddressLabel } from '../../../components/AddressLabel';
import NameServiceResolver, {
  useNameServiceStatus,
} from '../../../components/NameServiceResolver';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { useSingleToken } from '../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { lightningNetworkSendConfirm } from '../../LightningNetwork/Send/lightningNetworkSendUtils';
import { BaseSendModal } from '../components/BaseSendModal';
import NFTView from '../components/NFTView';
import { SendModalRoutes } from '../types';

import type { ModalScreenProps } from '../../../routes/types';
import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { MessageDescriptor } from 'react-intl';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.PreSendAddress>;

type FormValues = {
  to: string;
  destinationTag?: string;
  paymentId?: string;
};

function PreSendAddress() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const [securityItems, setSecurityItems] = useState<
    (keyof GoPlusAddressSecurity)[]
  >([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [displayDestinationTag, setDisplayDestinationTag] = useState(false);
  const [displayPaymentId, setDisplayPaymentId] = useState(false);
  const [isAddressBook, setIsAddressBook] = useState(false);
  const [addressBookLabel, setAddressBookLabel] = useState<
    string | undefined
  >();
  const [isContractAddress, setIsContractAddress] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [validAddressMessage, setValidAddressMessage] =
    useState<MessageDescriptor['id']>();
  const [validAddressMessageProperty, setValidAddressMessageProperty] =
    useState<Record<string, any>>();
  const { serviceNFT, serviceBatchTransfer, engine } = backgroundApiProxy;
  const routeParams = useMemo(() => ({ ...route.params }), [route.params]);
  const {
    validateAddress,
    transferInfos,
    accountId,
    networkId,
    closeModal,
    ...reset
  } = routeParams;
  const transferInfo =
    transferInfos && transferInfos.length > 0
      ? transferInfos[0]
      : (reset as ITransferInfo);
  const { isNFT, isBRC20 } = transferInfo;
  const { account, network, walletId } = useActiveSideAccount(routeParams);
  const isLightningNetwork = isLightningNetworkByImpl(network?.impl);
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
    isSearching: isNameServiceSearching,
    address: resolvedAddress,
  } = useNameServiceStatus();

  const { control, formState, trigger, handleSubmit } = useFormReturn;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { token: tokenInfo } = useSingleToken(
    networkId,
    transferInfo.token ?? '',
  );
  const nativeToken = useNativeToken(networkId);

  useEffect(() => {
    backgroundApiProxy.serviceToken.fetchAccountTokens({
      networkId,
      accountId,
    });
  }, [accountId, networkId]);

  const [nftInfo, updateNFTInfo] = useState<INFTAsset>();
  useEffect(() => {
    (async () => {
      if (isNFT) {
        const { nftTokenId } = transferInfo;
        if (nftTokenId) {
          const contractAddress = transferInfo.token;
          const asset = await serviceNFT.getAsset({
            accountId,
            networkId,
            contractAddress,
            tokenId: nftTokenId,
            local: true,
          });
          updateNFTInfo(asset);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferInfo.nftTokenId, transferInfo.token]);

  const [validateMessage, setvalidateMessage] = useState({
    errorMessage: '',
  });

  const [validAddressMessageFromOut, setValidAddressMessageFromOut] = useState({
    warningMessage: '',
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
          const isContractAddressResp =
            await backgroundApiProxy.validator.isContractAddress(
              networkId,
              address,
            );

          return isContractAddressResp;
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
      setDisplayPaymentId(vaultSettings?.withPaymentId ?? false);
    })();
  }, [networkId]);
  //
  const nftSendConfirm = useCallback(
    async (toVal: string) => {
      if (!account || !network) {
        return;
      }
      if (!nftInfo) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__nft_does_not_exist',
            }),
          },
          { type: 'error' },
        );
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

        for (let i = 0; i < transferInfos.length; i += 1) {
          transferInfos[i].from = account.address;
          transferInfos[i].to = toVal;
          const asset = await serviceNFT.getAsset({
            accountId,
            networkId,
            contractAddress: transferInfos[i].token,
            tokenId: transferInfos[i].nftTokenId ?? '',
            local: true,
          });

          if (asset) {
            nftInfos.push({
              asset: (asset || {}) as NFTAsset,
              amount: transferInfo.amount,
              from: account.address,
              to: toVal,
            });
          } else {
            ToastManager.show(
              {
                title: intl.formatMessage({
                  id: 'msg__nft_does_not_exist',
                }),
              },
              { type: 'error' },
            );
            return;
          }
        }
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
                transferInfos,
              },
              transferCount: transferInfos.length,
              onModalClose: closeModal,
              bulkType: BulkTypeEnum.OneToMany,
            },
          },
        });
      } else {
        try {
          setIsLoadingAssets(true);

          encodedTx = await engine.buildEncodedTxFromTransfer({
            networkId,
            accountId,
            transferInfo,
          });
          setIsLoadingAssets(false);
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
        } catch (error: any) {
          console.error('nftSendConfirm ERROR: ', error);

          const { key: errorKey = '', className } = error as OneKeyError;
          if (errorKey) {
            let data = {};
            if (
              errorKey === 'form__amount_invalid' &&
              className ===
                OneKeyErrorClassNames.OneKeyErrorInsufficientNativeBalance
            ) {
              data = {
                0: nativeToken?.symbol || '',
              };
            }
            ToastManager.show(
              {
                title: intl.formatMessage({ id: errorKey as any }, data),
              },
              { type: 'error' },
            );
          } else {
            ToastManager.show(
              {
                title: (error as Error)?.message || 'ERROR',
              },
              { type: 'error' },
            );
          }

          setIsLoadingAssets(false);
        }
      }
    },
    [
      account,
      network,
      nftInfo,
      transferInfo,
      transferInfos,
      intl,
      serviceBatchTransfer,
      networkId,
      accountId,
      navigation,
      closeModal,
      serviceNFT,
      engine,
      nativeToken?.symbol,
    ],
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      const toVal = resolvedAddress || values.to;
      if (isLoading || !toVal) {
        return;
      }
      if (isNFT || isBRC20) {
        nftSendConfirm(toVal);
      } else if (isLightningNetwork) {
        lightningNetworkSendConfirm({
          toVal,
          walletId,
          network,
          networkId,
          account,
          accountId,
          tokenInfo,
          transferInfo,
          navigation,
          setIsLoadingAssets,
          intl,
        });
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
              paymentId: values.paymentId,
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

  const PaymentIdForm = useMemo(() => {
    if (!displayPaymentId) return null;

    return (
      <Form.Item
        control={control}
        name="paymentId"
        rules={{
          validate: (value) => {
            if (!value) return undefined;
            if (
              !isHexString(addHexPrefix(value)) ||
              stripHexPrefix(value).length !== 64
            ) {
              return 'Payment ID must be a 64 char hex string';
            }
          },
        }}
      >
        <Form.Input type="text" placeholder="Payment ID" />
      </Form.Item>
    );
  }, [control, displayPaymentId]);

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
      const validate = async () => {
        const toAddress = resolvedAddress || value || '';
        setIsValidAddress(false);
        setvalidateMessage({
          errorMessage: '',
        });
        setValidAddressMessageFromOut({ warningMessage: '' });
        setIsAddressBook(false);
        setAddressBookLabel('');
        setIsContractAddress(false);
        setSecurityItems([]);
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
          const result = await validateAddress?.(networkId, toAddress);
          if (result && result.warningMessage) {
            setValidAddressMessageFromOut({
              warningMessage: result.warningMessage,
            });
          } else {
            setValidAddressMessageFromOut({
              warningMessage: '',
            });
          }
        } catch (error0: any) {
          console.error('PreSendAddress validateHandle ERROR: ', error0);

          setIsValidatingAddress(false);
          if (isValidNameServiceName && !resolvedAddress) return undefined;
          const { key, info } = error0;
          setIsValidAddress(false);
          setIsAddressBook(false);
          setAddressBookLabel('');
          setIsContractAddress(false);
          if (key) {
            setvalidateMessage({
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
            errorMessage: intl.formatMessage({
              id: 'form__address_invalid',
            }),
          });
          setValidAddressMessageFromOut({ warningMessage: '' });
          return false;
        }
        const isContractAddressResp = await isContractAddressCheck(toAddress);
        if (isContractAddressResp) {
          setvalidateMessage({
            errorMessage: '',
          });
          setIsValidAddress(true);
          setIsContractAddress(true);
        } else {
          const addressbookItem =
            await backgroundApiProxy.serviceAddressbook.getItem({
              address: toAddress,
            });
          if (addressbookItem) {
            setIsValidAddress(true);
            setIsAddressBook(true);
            setAddressBookLabel(addressbookItem.name);
            setvalidateMessage({
              errorMessage: '',
            });
          } else {
            setIsValidAddress(true);
            if (isLightningNetwork) {
              const isLnurl = findLnurl(toAddress);
              if (isLnurl) {
                setValidAddressMessage('msg__valid_str_payment_request');
                setValidAddressMessageProperty({ 0: 'LNURL' });
              } else {
                setValidAddressMessage('msg__valid_payment_request');
              }
            }
          }
        }
        setIsValidatingAddress(false);
        return true;
      };
      validate();
    },
    [
      resolvedAddress,
      isContractAddressCheck,
      networkId,
      accountId,
      validateAddress,
      isValidNameServiceName,
      intl,
      isLightningNetwork,
    ],
  );

  // Refresh pending tx status before entering the send confirm modal
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
              {isNFT && !isBRC20 ? (
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
                errorMessage={
                  isNameServiceSearching ? '' : validateMessage.errorMessage
                }
                warningMessage={validAddressMessageFromOut.warningMessage}
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
                  maxLength={isLightningNetwork ? 999 : 103}
                  networkId={networkId}
                  // numberOfLines={10}
                  h={{ base: 120, md: 120 }}
                  plugins={
                    isLightningNetwork
                      ? ['paste', 'scan']
                      : ['contact', 'paste', 'scan']
                  }
                  placeholder={
                    isLightningNetwork
                      ? intl.formatMessage({
                          id: 'content__enter_invoice_lightning_address_or_lnurl',
                        })
                      : undefined
                  }
                />
              </Form.Item>
              {DestinationTagForm}
              {PaymentIdForm}
            </Form>
            {!validateMessage.errorMessage && (
              <AddressLabel
                mt={1}
                shouldCheckSecurity
                securityInfo={securityItems}
                networkId={networkId}
                address={resolvedAddress || formValues?.to || ''}
                isAddressBook={isAddressBook}
                addressBookLabel={addressBookLabel}
                isContractAddress={isContractAddress}
                isValidAddress={isValidAddress}
                validAddressMessage={validAddressMessage}
                validAddressMessageProperty={validAddressMessageProperty}
                showValidAddressLabel
                isLoading={
                  isLoading || isValidatingAddress || formState.isValidating
                }
                labelStyle={{ mt: 1 }}
              />
            )}
            {isContractAddress && (
              <Alert
                alertType="info"
                title={intl.formatMessage({
                  id: 'msg__the_recipient_address_is_a_contract_address',
                })}
                dismiss={false}
                containerProps={{ mt: 4 }}
              />
            )}

            {securityItems.length > 0 && (
              <Alert
                alertType="warn"
                title={intl.formatMessage({
                  id: 'msg__the_recipient_address_is_a_scam_address',
                })}
                dismiss={false}
                containerProps={{ mt: 4 }}
              />
            )}
          </Box>
        ),
      }}
    />
  );
}

export { PreSendAddress };
