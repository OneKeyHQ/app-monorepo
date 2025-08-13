import type { ReactElement, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  ListView,
  Popover,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { getMergedDeriveTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { AccountSelectorProviderMirror } from '../AccountSelector/AccountSelectorProvider';
import { useAccountSelectorCreateAddress } from '../AccountSelector/hooks/useAccountSelectorCreateAddress';

import {
  AddressTypeSelectorContext,
  useAddressTypeSelectorContext,
} from './AddressTypeSelectorContext';
import AddressTypeSelectorItem from './AddressTypeSelectorItem';
import AddressTypeSelectorTrigger from './AddressTypeSelectorTrigger';

import type { PopoverProps } from 'tamagui';

type IProps = {
  walletId: string;
  networkId: string;
  indexedAccountId: string;
  activeDeriveType?: IAccountDeriveTypes;
  activeDeriveInfo?: IAccountDeriveInfo;
  title?: string | ReactElement;
  description?: string | ReactElement;
  helpLink?: string;
  onSelect?: (value: {
    account: INetworkAccount | undefined;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  }) => Promise<void>;
  onCreate?: (value: {
    account: IDBAccount | undefined;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  }) => Promise<void>;
  renderSelectorTrigger?: ReactNode;
  changeDefaultAddressTypeAfterSelect?: boolean;
  tokenMap?: Record<string, ITokenFiat>;
  disableSelector?: boolean;
  doubleConfirm?: boolean;
  showTriggerWhenDisabled?: boolean;
  placement?: PopoverProps['placement'];
};

function AddressTypeSelectorContent(
  props: IProps & {
    isOpen?: boolean;
    closePopover: () => void;
    networkAccounts: {
      account: INetworkAccount | undefined;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }[];
    refreshNetworkAccounts: () => Promise<void>;
    selectorTitle: string | ReactElement;
  },
) {
  const {
    networkId,
    indexedAccountId,
    description,
    onSelect,
    onCreate,
    changeDefaultAddressTypeAfterSelect = true,
    networkAccounts,
    refreshNetworkAccounts,
    selectorTitle,
    closePopover,
    doubleConfirm,
  } = props;

  const intl = useIntl();

  const { gtMd } = useMedia();

  const {
    activeDeriveType,
    setIsCreatingAddress,
    setActiveDeriveType,
    setCreatingDeriveType,
  } = useAddressTypeSelectorContext();

  const { createAddress } = useAccountSelectorCreateAddress();

  const selectorDescription = useMemo(() => {
    let defaultDescription =
      'After selecting the address type, the new address will be set as the default for transactions.';
    let hasCustomDescription = false;

    if (description) {
      hasCustomDescription = true;
      if (typeof description === 'string') {
        defaultDescription = description;
      } else {
        return description;
      }
    }

    if (hasCustomDescription || changeDefaultAddressTypeAfterSelect) {
      return (
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          mb="$4"
          $gtMd={{
            size: '$bodySm',
          }}
        >
          {defaultDescription}
        </SizableText>
      );
    }

    return null;
  }, [changeDefaultAddressTypeAfterSelect, description]);

  const handleAddressTypeOnSelect = useCallback(
    async ({
      account,
      deriveInfo,
      deriveType,
    }: {
      account: INetworkAccount | undefined;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }) => {
      if (!account) {
        try {
          setIsCreatingAddress(true);
          setCreatingDeriveType(deriveType);
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: indexedAccountId,
          });
          const createAddressResult = await createAddress({
            selectAfterCreate: false,
            num: 0,
            account: {
              walletId,
              indexedAccountId,
              deriveType,
              networkId,
            },
          });
          if (createAddressResult) {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.swap_page_toast_address_generated,
              }),
            });
            void onCreate?.({
              account: createAddressResult.accounts[0],
              deriveInfo,
              deriveType,
            });
          }
          void refreshNetworkAccounts?.();
        } finally {
          setIsCreatingAddress(false);
          setCreatingDeriveType(undefined);
        }
        return;
      }

      if (deriveType === activeDeriveType) {
        if (!doubleConfirm) {
          closePopover();
        }
        return;
      }

      setActiveDeriveType(deriveType);

      if (!doubleConfirm) {
        if (changeDefaultAddressTypeAfterSelect) {
          console.log('saveGlobalDeriveTypeForNetwork', networkId, deriveType);
          await backgroundApiProxy.serviceNetwork.saveGlobalDeriveTypeForNetwork(
            {
              networkId,
              deriveType,
            },
          );
        }
        void onSelect?.({
          account,
          deriveInfo,
          deriveType,
        });
        closePopover();
      }
    },
    [
      onSelect,
      activeDeriveType,
      setActiveDeriveType,
      doubleConfirm,
      setIsCreatingAddress,
      setCreatingDeriveType,
      indexedAccountId,
      createAddress,
      networkId,
      refreshNetworkAccounts,
      intl,
      onCreate,
      closePopover,
      changeDefaultAddressTypeAfterSelect,
    ],
  );

  return (
    <YStack
      pb="$3"
      $gtMd={{
        pt: '$3',
      }}
      onPress={(e) => {
        e.stopPropagation();
      }}
    >
      <YStack px="$4">
        {gtMd ? selectorTitle : null}
        {selectorDescription}
      </YStack>
      <ListView
        data={networkAccounts}
        renderItem={({ item }) => {
          return (
            <AddressTypeSelectorItem
              data={item}
              onSelect={handleAddressTypeOnSelect}
            />
          );
        }}
      />
      {doubleConfirm ? (
        <XStack px="$5" pt="$4">
          <Button
            flex={1}
            size="medium"
            variant="primary"
            onPress={async () => {
              if (!activeDeriveType) {
                return;
              }
              const currentNetworkAccount = networkAccounts.find(
                (item) => item.deriveType === activeDeriveType,
              );
              if (changeDefaultAddressTypeAfterSelect) {
                await backgroundApiProxy.serviceNetwork.saveGlobalDeriveTypeForNetwork(
                  {
                    networkId,
                    deriveType: activeDeriveType,
                  },
                );
              }

              if (currentNetworkAccount) {
                void onSelect?.({
                  account: currentNetworkAccount.account,
                  deriveInfo: currentNetworkAccount.deriveInfo,
                  deriveType: currentNetworkAccount.deriveType,
                });
              }
              closePopover();
            }}
            $gtMd={{
              size: 'small',
            }}
          >
            Confirm receiving address
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}

function AddressTypeSelector(props: IProps) {
  const intl = useIntl();
  const {
    walletId,
    networkId,
    indexedAccountId,
    title,
    helpLink,
    renderSelectorTrigger,
    tokenMap: tokenMapProp,
    activeDeriveType: activeDeriveTypeProp,
    activeDeriveInfo: activeDeriveInfoProp,
    disableSelector,
    showTriggerWhenDisabled = false,
    placement,
    doubleConfirm,
  } = props;

  const isSelectorDisabled = useMemo(() => {
    return disableSelector || accountUtils.isOthersWallet({ walletId });
  }, [disableSelector, walletId]);

  const [activeDeriveType, setActiveDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(activeDeriveTypeProp);

  const [creatingDeriveType, setCreatingDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(undefined);

  const [tokenMap, setTokenMap] = useState<
    Record<string, ITokenFiat> | undefined
  >(tokenMapProp);

  const [isFetchingTokenMap, setIsFetchingTokenMap] = useState(false);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);

  const { result: networkAccounts, run: refreshNetworkAccounts } =
    usePromiseResult(
      async () => {
        const result =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId,
              indexedAccountId,
            },
          );

        return result.networkAccounts;
      },
      [networkId, indexedAccountId],
      {
        initResult: [],
      },
    );

  const activeDeriveInfo = useMemo(() => {
    if (activeDeriveInfoProp) {
      return activeDeriveInfoProp;
    }

    return networkAccounts.find((item) => item.deriveType === activeDeriveType)
      ?.deriveInfo;
  }, [activeDeriveInfoProp, networkAccounts, activeDeriveType]);

  const selectorTitle = useMemo(() => {
    let defaultTitle = 'Select address type';

    if (title)
      if (typeof title === 'string') {
        defaultTitle = title;
      } else {
        return title;
      }

    return (
      <XStack
        alignItems="center"
        gap={6}
        $gtMd={{
          mb: '$2',
        }}
      >
        <SizableText
          size="$bodyLgMedium"
          $gtMd={{
            size: '$headingSm',
          }}
        >
          {defaultTitle}
        </SizableText>
        {helpLink ? (
          <IconButton
            size="small"
            variant="tertiary"
            icon="QuestionmarkOutline"
            onPress={() => {
              openUrlExternal(helpLink);
            }}
          />
        ) : null}
      </XStack>
    );
  }, [helpLink, title]);

  const contextValue = useMemo(
    () => ({
      tokenMap,
      activeDeriveType,
      creatingDeriveType,
      networkId,
      isFetchingTokenMap,
      isCreatingAddress,
      setIsCreatingAddress,
      setActiveDeriveType,
      setCreatingDeriveType,
    }),
    [
      tokenMap,
      activeDeriveType,
      creatingDeriveType,
      networkId,
      isFetchingTokenMap,
      isCreatingAddress,
      setIsCreatingAddress,
      setActiveDeriveType,
      setCreatingDeriveType,
    ],
  );

  useEffect(() => {
    const fetchDefaultDeriveType = async () => {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      setActiveDeriveType(defaultDeriveType);
    };

    if (!activeDeriveTypeProp) {
      void fetchDefaultDeriveType();
    }
  }, [activeDeriveTypeProp, networkId]);

  useEffect(() => {
    const fetchTokenMap = async () => {
      const networkAccountsWithAccountId = networkAccounts.filter(
        (item) => item.account?.id,
      );

      if (networkAccountsWithAccountId.length === 0) {
        return;
      }

      setIsFetchingTokenMap(true);

      const resp = await Promise.all(
        networkAccountsWithAccountId.map((networkAccount) =>
          backgroundApiProxy.serviceToken.fetchAccountTokens({
            accountId: networkAccount.account?.id ?? '',
            mergeTokens: true,
            networkId,
            flag: 'address-type-selector',
          }),
        ),
      );

      const { tokenListMap } = getMergedDeriveTokenData({
        data: resp,
        mergeDeriveAssetsEnabled: true,
      });
      setTokenMap(tokenListMap);

      setIsFetchingTokenMap(false);
    };

    if (!tokenMapProp) {
      void fetchTokenMap();
    }
  }, [tokenMapProp, networkAccounts, networkId]);

  if (isSelectorDisabled && showTriggerWhenDisabled) {
    return (
      <AddressTypeSelectorTrigger
        activeDeriveInfo={activeDeriveInfo}
        disableSelector={isSelectorDisabled}
      />
    );
  }

  return (
    <Popover
      placement={placement}
      title={selectorTitle}
      renderTrigger={
        renderSelectorTrigger ?? (
          <AddressTypeSelectorTrigger activeDeriveInfo={activeDeriveInfo} />
        )
      }
      renderContent={({ isOpen, closePopover }) => (
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
          enabledNum={[0]}
        >
          <AddressTypeSelectorContext.Provider value={contextValue}>
            <AddressTypeSelectorContent
              isOpen={isOpen}
              closePopover={closePopover}
              networkAccounts={networkAccounts}
              refreshNetworkAccounts={refreshNetworkAccounts}
              selectorTitle={selectorTitle}
              {...props}
            />
          </AddressTypeSelectorContext.Provider>
        </AccountSelectorProviderMirror>
      )}
      onOpenChange={(open) => {
        if (!open && doubleConfirm) {
          void backgroundApiProxy.serviceNetwork
            .getGlobalDeriveTypeOfNetwork({
              networkId,
            })
            .then((deriveType) => {
              setActiveDeriveType(deriveType);
            });
        }
      }}
    />
  );
}

export default memo(AddressTypeSelector);
