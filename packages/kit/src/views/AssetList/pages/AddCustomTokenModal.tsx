import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Button,
  Form,
  Icon,
  Input,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ECustomTokenStatus,
  type IAccountToken,
  type IAddCustomTokenRouteParams,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAvatar } from '../../../components/NetworkAvatar/NetworkAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useDappCloseHandler } from '../../DAppConnection/pages/DappOpenModalPage';
import {
  useAddToken,
  useAddTokenForm,
  useCheckAccountExist,
} from '../hooks/useAddToken';

import type { RouteProp } from '@react-navigation/core';

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function CreateAddressButton(props: IButtonProps) {
  const intl = useIntl();
  return (
    <Button
      $md={
        {
          flexGrow: 1,
          flexBasis: 0,
          size: 'large',
        } as any
      }
      variant="primary"
      {...props}
    >
      {intl.formatMessage({ id: ETranslations.global_create_address })}
    </Button>
  );
}

function AddCustomTokenModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.AddCustomTokenModal
      >
    >();
  const {
    walletId: routeWalletId,
    networkId: routeNetworkId,
    indexedAccountId: routeIndexedAccountId,
    accountId: routeAccountId,
    isOthersWallet: routeIsOthersWallet,
    deriveType: routeDeriveType,
    token: routeToken,
    onSuccess: routeOnSuccess,
  } = route.params;

  const {
    $sourceInfo,
    walletId: dappWalletId,
    networkId: dappNetworkId,
    indexedAccountId: dappIndexedAccountId,
    accountId: dappAccountId,
    isOthersWallet: dappIsOthersWallet,
    deriveType: dappDeriveType,
    token: dappToken,
    onSuccess: dappOnSuccess,
  } = useDappQuery<IAddCustomTokenRouteParams>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const walletId = dappWalletId ?? routeWalletId;
  const networkId = dappNetworkId ?? routeNetworkId;
  const indexedAccountId = dappIndexedAccountId ?? routeIndexedAccountId;
  const accountId = dappAccountId ?? routeAccountId;
  const isOthersWallet = dappIsOthersWallet ?? routeIsOthersWallet;
  const deriveType = dappDeriveType ?? routeDeriveType;
  const token = dappToken ?? routeToken;
  const onSuccess = dappOnSuccess ?? routeOnSuccess;

  const isAllNetwork = networkUtils.isAllNetwork({ networkId });

  const {
    form,
    isEmptyContract,
    setIsEmptyContractState,
    selectedNetworkIdValue,
    contractAddressValue,
    symbolValue,
    decimalsValue,
    isSymbolEditable,
    setIsSymbolEditable,
  } = useAddTokenForm({
    token,
    networkId,
  });

  const { hasExistAccount, runCheckAccountExist, checkAccountIsExist } =
    useCheckAccountExist({
      accountId,
      networkId,
      isOthersWallet,
      indexedAccountId,
      deriveType,
      selectedNetworkIdValue,
    });

  const { availableNetworks, searchedTokenRef, isSearching } = useAddToken({
    token,
    walletId,
    networkId,
    form,
    selectedNetworkIdValue,
    contractAddressValue,
    setIsEmptyContractState,
    setIsSymbolEditable,
    checkAccountIsExist,
  });

  const { result: vaultSettings } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: selectedNetworkIdValue,
      }),
    [selectedNetworkIdValue],
  );

  const [isLoading, setIsLoading] = useState(false);
  const disabled = useMemo(() => {
    if (!hasExistAccount) {
      return true;
    }
    if (isEmptyContract) {
      return true;
    }
    if (!symbolValue || !new BigNumber(decimalsValue).isInteger()) {
      return true;
    }
    if (isLoading) {
      return true;
    }
    if (isSearching) {
      return true;
    }
    return false;
  }, [
    symbolValue,
    decimalsValue,
    isEmptyContract,
    isLoading,
    hasExistAccount,
    isSearching,
  ]);

  const onConfirm = useCallback(
    async (close?: () => void) => {
      if (!searchedTokenRef.current) {
        Toast.error({ title: 'Searching token, please try again later' });
        return;
      }
      setIsLoading(true);
      // Step1 -> Create Address
      const { hasExistAccountFlag, accountIdForNetwork } =
        await checkAccountIsExist();
      if (!hasExistAccountFlag) {
        Toast.error({ title: 'Account not exist' });
        dappApprove.reject();
        return;
      }
      const values = form.getValues();
      const { contractAddress, symbol, decimals } = values;
      if (!contractAddress && !token?.isNative) {
        setIsLoading(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.manage_token_custom_token_address_required,
          }),
        });
        dappApprove.reject({
          error: new OneKeyError({
            key: ETranslations.manage_token_custom_token_address_required,
          }),
        });
        return;
      }
      if (!symbol || !new BigNumber(decimals).isInteger()) {
        setIsLoading(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.send_engine_incorrect_address,
          }),
        });
        dappApprove.reject({
          error: new OneKeyError({
            key: ETranslations.send_engine_incorrect_address,
          }),
        });
        return;
      }
      try {
        if (searchedTokenRef.current?.networkId !== selectedNetworkIdValue) {
          throw new OneKeyLocalError('Token networkId not matched');
        }
        if (
          normalizeAddress(searchedTokenRef.current?.address) !==
          normalizeAddress(contractAddress)
        ) {
          throw new OneKeyLocalError('Token address not matched');
        }
        const decimalsBN = new BigNumber(searchedTokenRef.current?.decimals);
        if (decimalsBN.isNaN()) {
          throw new OneKeyLocalError('Token decimal is invalid');
        }

        const tokenInfo: IAccountToken = {
          ...searchedTokenRef.current,
          address: searchedTokenRef.current?.address,
          symbol,
          decimals: decimalsBN.toNumber(),
          accountId: accountIdForNetwork,
          networkId: selectedNetworkIdValue,
          name: searchedTokenRef.current?.name || symbol || '',
          isNative: searchedTokenRef.current?.isNative ?? false,
          $key: `${selectedNetworkIdValue}_${contractAddress}`,
        };
        await backgroundApiProxy.serviceCustomToken.activateToken({
          accountId: accountIdForNetwork,
          networkId: selectedNetworkIdValue,
          token: tokenInfo,
        });
        const accountXpubOrAddress =
          await backgroundApiProxy.serviceAccount.getAccountXpubOrAddress({
            accountId: accountIdForNetwork,
            networkId: selectedNetworkIdValue,
          });
        await backgroundApiProxy.serviceCustomToken.addCustomToken({
          token: {
            ...tokenInfo,
            accountXpubOrAddress: accountXpubOrAddress || '',
            tokenStatus: ECustomTokenStatus.Custom,
          },
        });
      } catch (error) {
        Toast.error({ title: (error as Error)?.message });
        throw error;
      } finally {
        setIsLoading(false);
      }
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.address_book_add_address_toast_add_success,
        }),
      });
      setTimeout(() => {
        void dappApprove.resolve();
        onSuccess?.();
        close?.();
      }, 300);
    },
    [
      form,
      checkAccountIsExist,
      selectedNetworkIdValue,
      token?.isNative,
      intl,
      onSuccess,
      searchedTokenRef,
      dappApprove,
    ],
  );

  const renderNetworkSelectorFormItem = useCallback(() => {
    if (isAllNetwork) {
      return (
        <Form.Field
          label={intl.formatMessage({ id: ETranslations.global_chain })}
          name="networkId"
        >
          <ControlledNetworkSelectorTrigger
            networkIds={availableNetworks?.networkIds}
          />
        </Form.Field>
      );
    }
    return (
      <Form.Field
        label={intl.formatMessage({ id: ETranslations.global_network })}
        name="networkId"
      >
        <Stack
          userSelect="none"
          flexDirection="row"
          alignItems="center"
          borderRadius="$3"
          borderWidth={1}
          borderCurve="continuous"
          borderColor="$borderStrong"
          px="$3"
          py="$2.5"
          $gtMd={{
            borderRadius: '$2',
            py: '$2',
          }}
          testID="network-selector-input"
        >
          <NetworkAvatar networkId={networkId} size="$6" />
          <SizableText
            testID="network-selector-input-text"
            px={14}
            flex={1}
            size="$bodyLg"
          >
            {availableNetworks?.network.name ?? ''}
          </SizableText>
        </Stack>
      </Form.Field>
    );
  }, [availableNetworks, intl, isAllNetwork, networkId]);

  const handleOnClose = useDappCloseHandler(dappApprove);

  return (
    <Page onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.manage_token_custom_token_title,
        })}
      />
      <Page.Body px="$5">
        <Form form={form}>
          {renderNetworkSelectorFormItem()}
          {vaultSettings?.isNativeTokenContractAddressEmpty ? null : (
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.manage_token_custom_token_contract_address,
              })}
              rules={{
                validate: () => {
                  if (isEmptyContract) {
                    return intl.formatMessage({
                      id: ETranslations.token_manage_custom_token_address_failed,
                    });
                  }
                },
              }}
              name="contractAddress"
            >
              <Input
                size="large"
                $gtMd={{
                  size: 'medium',
                }}
                editable={!token?.isNative}
              />
            </Form.Field>
          )}
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_symbol,
            })}
            rules={{
              required: isSymbolEditable
                ? {
                    value: true,
                    message: intl.formatMessage({
                      id: ETranslations.manage_token_token_required,
                    }),
                  }
                : false,
            }}
            name="symbol"
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              editable={isSymbolEditable}
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_decimal,
            })}
            name="decimals"
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              editable={false}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={
          isSearching
            ? intl.formatMessage({
                // id: ETranslations.global_pending,
                id: ETranslations.manage_token_custom_token_add_btn,
              })
            : intl.formatMessage({
                id: ETranslations.manage_token_custom_token_add_btn,
              })
        }
        onConfirm={onConfirm}
        confirmButtonProps={{
          loading: isLoading,
          disabled,
        }}
      >
        {hasExistAccount ? undefined : (
          <Stack
            testID="add-custom-token-modal-footer"
            p="$5"
            bg="$bgApp"
            $md={{ height: 130 }}
          >
            <Stack
              flex={1}
              $gtMd={{
                gap: '$2.5',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              $md={{
                gap: '$5',
              }}
            >
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodyMdMedium" color="$text">
                  {intl.formatMessage({
                    id: ETranslations.manage_token_custom_token_create_address,
                  })}
                </SizableText>
                <Icon name="ArrowRightOutline" color="$iconSubdued" size="$5" />
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.manage_token_custom_token_add,
                  })}
                </SizableText>
              </XStack>
              <AccountSelectorCreateAddressButton
                num={0}
                account={{
                  walletId,
                  indexedAccountId,
                  networkId: selectedNetworkIdValue,
                  deriveType,
                }}
                buttonRender={CreateAddressButton}
                onCreateDone={() => {
                  setTimeout(() => {
                    void runCheckAccountExist();
                  });
                }}
              />
            </Stack>
          </Stack>
        )}
      </Page.Footer>
    </Page>
  );
}

function AddCustomTokenModalWithMirror() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <AddCustomTokenModal />
    </AccountSelectorProviderMirror>
  );
}

export default AddCustomTokenModalWithMirror;
