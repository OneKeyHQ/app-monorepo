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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkAvatar } from '../../../components/NetworkAvatar/NetworkAvatar';
import {
  useAddToken,
  useAddTokenForm,
  useCheckAccountExist,
} from '../hooks/useAddToken';

import type { RouteProp } from '@react-navigation/core';

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
    walletId,
    networkId,
    indexedAccountId,
    accountId,
    isOthersWallet,
    deriveType,
    token,
    onSuccess,
  } = route.params;

  const isAllNetwork = networkUtils.isAllNetwork({ networkId });

  const {
    form,
    isEmptyContract,
    setIsEmptyContractState,
    selectedNetworkIdValue,
    contractAddressValue,
    symbolValue,
    decimalsValue,
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

  const {
    availableNetworks,
    existTokenList,
    searchedTokenRef,
    tokenListFetchFinishedRef,
    fetchTokenList,
  } = useAddToken({
    token,
    walletId,
    networkId,
    form,
    selectedNetworkIdValue,
    contractAddressValue,
    setIsEmptyContractState,
    checkAccountIsExist,
  });

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
    return false;
  }, [symbolValue, decimalsValue, isEmptyContract, isLoading, hasExistAccount]);

  const onConfirm = useCallback(
    async (close?: () => void) => {
      setIsLoading(true);
      // Step1 -> Create Address
      const { hasExistAccountFlag, accountIdForNetwork } =
        await checkAccountIsExist();
      if (!hasExistAccountFlag) {
        Toast.error({ title: 'Account not exist' });
        return;
      }
      const values = form.getValues();
      const { contractAddress, symbol, decimals } = values;
      if (!contractAddress && !token?.isNative) {
        setIsLoading(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.manger_token_custom_token_address_required,
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
        return;
      }
      let tokenList = existTokenList?.allTokens;
      if (!tokenListFetchFinishedRef.current) {
        tokenList = await fetchTokenList({ accountId: accountIdForNetwork });
      }
      const tokenWithoutHidden = tokenList?.data.filter(
        (t) =>
          !existTokenList?.hiddenTokens.find(
            (hideToken) =>
              t.address.toLowerCase() === hideToken.address.toLowerCase(),
          ),
      );
      if (
        tokenWithoutHidden?.find(
          (t) => t.address.toLowerCase() === contractAddress.toLowerCase(),
        )
      ) {
        setIsLoading(false);
        Toast.error({
          title: 'Token already exists',
        });
        return;
      }
      try {
        const tokenInfo = {
          address: contractAddress,
          symbol,
          decimals: new BigNumber(decimals).toNumber(),
          ...searchedTokenRef.current,
          accountId: accountIdForNetwork,
          networkId: selectedNetworkIdValue,
          allNetworkAccountId: isAllNetwork ? accountId : undefined,
          name: searchedTokenRef.current?.name ?? '',
          isNative: searchedTokenRef.current?.isNative ?? false,
          $key: `${selectedNetworkIdValue}_${contractAddress}`,
        };
        await backgroundApiProxy.serviceCustomToken.activateToken({
          accountId: accountIdForNetwork,
          networkId: selectedNetworkIdValue,
          token: tokenInfo,
        });
        await backgroundApiProxy.serviceCustomToken.addCustomToken({
          token: tokenInfo,
        });
      } finally {
        setIsLoading(false);
      }
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.address_book_add_address_toast_add_success,
        }),
      });
      setTimeout(() => {
        onSuccess?.();
        close?.();
      }, 300);
    },
    [
      form,
      checkAccountIsExist,
      fetchTokenList,
      existTokenList,
      selectedNetworkIdValue,
      token?.isNative,
      intl,
      onSuccess,
      isAllNetwork,
      accountId,
      searchedTokenRef,
      tokenListFetchFinishedRef,
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
          <SizableText px={14} flex={1} size="$bodyLg">
            {availableNetworks?.network.name ?? ''}
          </SizableText>
        </Stack>
      </Form.Field>
    );
  }, [availableNetworks, intl, isAllNetwork, networkId]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.manage_token_custom_token_title,
        })}
      />
      <Page.Body px="$5">
        <Form form={form}>
          {renderNetworkSelectorFormItem()}
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_contract_address,
            })}
            rules={{
              validate: () => {
                if (isEmptyContract) {
                  return intl.formatMessage({
                    id: ETranslations.Token_manage_custom_token_address_faild,
                  });
                }
              },
            }}
            name="contractAddress"
          >
            <Input editable={!token?.isNative} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_symbol,
            })}
            name="symbol"
          >
            <Input editable={false} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_decimal,
            })}
            name="decimals"
          >
            <Input editable={false} />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.manage_token_custom_token_add_btn,
        })}
        onConfirm={onConfirm}
        confirmButtonProps={{
          loading: isLoading,
          disabled,
        }}
      >
        {hasExistAccount ? undefined : (
          <Stack
            p="$5"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
            bg="$bgApp"
          >
            <XStack
              space="$2.5"
              $gtMd={{
                ml: 'auto',
              }}
              flex={1}
              justifyContent="space-between"
            >
              <XStack alignItems="center" space="$2">
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
            </XStack>
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
