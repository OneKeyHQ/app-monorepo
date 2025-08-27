import type { ReactElement, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  ListView,
  Popover,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { getMergedDeriveTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { AccountSelectorProviderMirror } from '../AccountSelector/AccountSelectorProvider';
import { useAccountSelectorCreateAddress } from '../AccountSelector/hooks/useAccountSelectorCreateAddress';

import {
  AddressTypeSelectorDynamicContext,
  AddressTypeSelectorStableContext,
  useAddressTypeSelectorDynamicContext,
} from './AddressTypeSelectorContext';
import AddressTypeSelectorItem from './AddressTypeSelectorItem';
import AddressTypeSelectorTrigger from './AddressTypeSelectorTrigger';

import type { PopoverProps } from 'tamagui';

const helpLinkMap: Record<string, string> = {
  [IMPL_BTC]: 'https://help.onekey.so/articles/11461370',
  [IMPL_TBTC]: 'https://help.onekey.so/articles/11461370',
};

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
  confirmText?: string;
  offset?: PopoverProps['offset'];
};

const StrongText = (chunks: (string | ReactElement)[]) => (
  <SizableText
    size="$bodyMdMedium"
    $gtMd={{
      size: '$bodySmMedium',
    }}
    color="$text"
  >
    {chunks}
  </SizableText>
);

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
    selectorTitle: string | ReactNode;
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
    confirmText,
  } = props;

  const intl = useIntl();

  const {
    activeDeriveType,
    setIsCreatingAddress,
    setActiveDeriveType,
    setCreatingDeriveType,
  } = useAddressTypeSelectorDynamicContext();

  const { createAddress } = useAccountSelectorCreateAddress();

  const selectorDescription = useMemo(() => {
    let defaultDescription = intl.formatMessage(
      {
        id: ETranslations.address_type_selector_desc,
      },
      {
        strong: StrongText,
      },
    );
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
          $gtMd={{
            size: '$bodySm',
          }}
        >
          {defaultDescription}
        </SizableText>
      );
    }

    return null;
  }, [changeDefaultAddressTypeAfterSelect, description, intl]);

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
          void onSelect?.({
            account,
            deriveInfo,
            deriveType,
          });
          closePopover();
        }
        return;
      }

      setActiveDeriveType(deriveType);

      if (!doubleConfirm) {
        if (changeDefaultAddressTypeAfterSelect) {
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
      onSelect,
    ],
  );

  return (
    <YStack
      p="$3"
      $gtMd={{
        p: '$2',
      }}
      gap="$4"
      onPress={(e) => {
        e.stopPropagation();
      }}
    >
      <YStack px="$2" py="$1" gap="$2">
        {selectorTitle}
        {selectorDescription}
      </YStack>
      <ListView
        gap="$1.5"
        data={networkAccounts}
        renderItem={({ item }) => {
          return (
            <AddressTypeSelectorItem
              key={item.deriveType}
              data={item}
              onSelect={handleAddressTypeOnSelect}
            />
          );
        }}
      />
      {doubleConfirm ? (
        <XStack px="$2" pb="$2">
          <Button
            flex={1}
            size="medium"
            variant="primary"
            $gtMd={{
              size: 'small',
            }}
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
          >
            {confirmText ||
              intl.formatMessage({
                id: ETranslations.address_type_selector_cta,
              })}
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}

const SelectorTitle = ({
  title,
  helpLink,
  closePopover,
}: {
  title: string | ReactElement | undefined;
  helpLink: string;
  closePopover: () => void;
}) => {
  const intl = useIntl();
  let defaultTitle = intl.formatMessage({
    id: ETranslations.address_type_selector_title,
  });

  if (title)
    if (typeof title === 'string') {
      defaultTitle = title;
    } else {
      return title;
    }

  return (
    <XStack alignItems="center" justifyContent="space-between">
      <XStack
        gap={6}
        alignItems="center"
        {...(helpLink && {
          cursor: 'pointer',
          px: '$2',
          py: '$1',
          mx: '$-2',
          my: '$-1',
          borderRadius: '$2',
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
          onPress: () => {
            openUrlExternal(helpLink);
          },
        })}
      >
        <SizableText
          size="$headingMd"
          $gtMd={{
            size: '$headingSm',
          }}
        >
          {defaultTitle}
        </SizableText>
        {helpLink ? (
          <Icon name="QuestionmarkOutline" size="$4" color="$iconSubdued" />
        ) : null}
      </XStack>
      <IconButton
        $gtMd={{
          display: 'none',
        }}
        icon="CrossedSmallOutline"
        variant="tertiary"
        onPress={() => {
          closePopover();
        }}
      />
    </XStack>
  );
};

function AddressTypeSelector(props: IProps) {
  const {
    walletId,
    networkId,
    indexedAccountId,
    title,
    helpLink: helpLinkProp,
    renderSelectorTrigger,
    tokenMap: tokenMapProp,
    activeDeriveType: activeDeriveTypeProp,
    activeDeriveInfo: activeDeriveInfoProp,
    disableSelector,
    showTriggerWhenDisabled = false,
    placement,
    doubleConfirm,
    offset,
  } = props;

  const { network } = useAccountData({
    networkId,
  });

  const helpLink = useMemo(() => {
    const impl = networkUtils.getNetworkImpl({ networkId });
    return helpLinkProp || helpLinkMap[impl];
  }, [networkId, helpLinkProp]);

  const isSelectorDisabled = useMemo(() => {
    return disableSelector ?? accountUtils.isOthersWallet({ walletId });
  }, [disableSelector, walletId]);

  const [activeDeriveType, setActiveDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >();

  const [creatingDeriveType, setCreatingDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(undefined);

  const [tokenMap, setTokenMap] = useState<
    Record<string, ITokenFiat> | undefined
  >();

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

  const stableContextValue = useMemo(
    () => ({
      tokenMap,
      networkId,
      networkLogoURI: network?.logoURI,
      isFetchingTokenMap,
    }),
    [tokenMap, networkId, network?.logoURI, isFetchingTokenMap],
  );

  const dynamicContextValue = useMemo(
    () => ({
      activeDeriveType,
      creatingDeriveType,
      isCreatingAddress,
      setIsCreatingAddress,
      setActiveDeriveType,
      setCreatingDeriveType,
    }),
    [
      activeDeriveType,
      creatingDeriveType,
      isCreatingAddress,
      setIsCreatingAddress,
      setActiveDeriveType,
      setCreatingDeriveType,
    ],
  );

  const activeDeriveTypeRef = useRef(activeDeriveType);
  const isCreatingAddressRef = useRef(isCreatingAddress);
  const dynamicContextValueRef = useRef(dynamicContextValue);

  activeDeriveTypeRef.current = activeDeriveType;
  isCreatingAddressRef.current = isCreatingAddress;
  dynamicContextValueRef.current = dynamicContextValue;

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
    } else {
      setActiveDeriveType(activeDeriveTypeProp);
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
    } else {
      setTokenMap(tokenMapProp);
    }
  }, [tokenMapProp, networkAccounts, networkId]);

  useEffect(() => {
    const fn = () => {
      void refreshNetworkAccounts();
    };
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [refreshNetworkAccounts]);

  const renderContent = useCallback(
    ({
      isOpen,
      closePopover,
    }: {
      isOpen?: boolean;
      closePopover: () => void;
    }) => (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
      >
        <AddressTypeSelectorStableContext.Provider value={stableContextValue}>
          <AddressTypeSelectorDynamicContext.Provider
            value={dynamicContextValueRef.current}
          >
            <AddressTypeSelectorContent
              isOpen={isOpen}
              closePopover={closePopover}
              networkAccounts={networkAccounts}
              refreshNetworkAccounts={refreshNetworkAccounts}
              selectorTitle={
                <SelectorTitle
                  title={title}
                  helpLink={helpLink}
                  closePopover={closePopover}
                />
              }
              {...props}
            />
          </AddressTypeSelectorDynamicContext.Provider>
        </AddressTypeSelectorStableContext.Provider>
      </AccountSelectorProviderMirror>
    ),
    [
      stableContextValue,
      networkAccounts,
      refreshNetworkAccounts,
      helpLink,
      title,
      props,
    ],
  );

  if (isSelectorDisabled) {
    return showTriggerWhenDisabled
      ? renderSelectorTrigger ?? (
          <AddressTypeSelectorTrigger
            activeDeriveInfo={activeDeriveInfo}
            disableSelector={isSelectorDisabled}
          />
        )
      : null;
  }

  return (
    <Popover
      offset={offset}
      placement={placement}
      title=""
      showHeader={false}
      renderTrigger={
        renderSelectorTrigger ?? (
          <AddressTypeSelectorTrigger activeDeriveInfo={activeDeriveInfo} />
        )
      }
      renderContent={renderContent}
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
      floatingPanelProps={{
        width: '$80',
      }}
    />
  );
}

export default memo(AddressTypeSelector);
