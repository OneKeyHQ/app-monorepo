import { memo, useMemo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

type IProps = { createAddressDisabled?: boolean } & IXStackProps;

function BatchCreateAddressButtonTest() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  return (
    <Button
      onPress={async () => {
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.BatchCreateAccountForm,
          params: {
            walletId: activeAccount?.wallet?.id || '',
          },
        });
        // const r =
        //   await backgroundApiProxy.serviceCreateBatchAccount.batchBuildAccounts(
        //     {
        //       walletId: activeAccount?.wallet?.id || '',
        //       networkId: activeAccount?.network?.id || '',
        //       deriveType: activeAccount?.deriveType,
        //       fromIndex: 4,
        //       toIndex: 22,
        //       excludeIndexes: {
        //         15: true,
        //         5: true,
        //         21: true,
        //       },
        //       saveToDb: true,
        //     },
        //   );
        // console.log('BatchCreateAddressButtonTest>>>', r);
      }}
      size="small"
    >
      BatchCreateAddress
    </Button>
  );
}

function HomeSelector(props: IProps) {
  const media = useMedia();
  const num = 0;

  const { createAddressDisabled, ...rest } = props;

  const batchCreateAddressButton = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return <BatchCreateAddressButtonTest />;
    }
    return null;
  }, []);

  return (
    <XStack
      testID="Wallet-Address-Generator"
      alignItems="center"
      space="$3"
      {...rest}
    >
      <NetworkSelectorTriggerHome num={num} />
      {!createAddressDisabled ? (
        <AccountSelectorActiveAccountHome num={num} />
      ) : null}
      {!createAddressDisabled ? (
        <DeriveTypeSelectorTrigger
          renderTrigger={({ label }) => (
            <XStack
              testID="wallet-derivation-path-selector-trigger"
              role="button"
              borderRadius="$2"
              userSelect="none"
              alignItems="center"
              p="$1"
              my="$-1"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusStyle={{
                outlineWidth: 2,
                outlineOffset: 0,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
              $platform-native={{
                hitSlop: {
                  right: 16,
                  top: 16,
                  bottom: 16,
                },
              }}
              focusable
            >
              <Icon name="BranchesOutline" color="$iconSubdued" size="$4.5" />
              {media.gtSm ? (
                <SizableText
                  pl="$2"
                  pr="$1"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {label}
                </SizableText>
              ) : null}
            </XStack>
          )}
          num={num}
        />
      ) : null}
      {batchCreateAddressButton}
    </XStack>
  );
}

export default memo(HomeSelector);
