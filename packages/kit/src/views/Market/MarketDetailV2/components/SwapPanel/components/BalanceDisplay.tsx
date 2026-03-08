import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  NumberSizeableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { InfoItemLabel } from './InfoItemLabel';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

export interface IBalanceDisplayProps {
  balance?: BigNumber;
  token?: IToken;
  isLoading?: boolean;
  onBalanceClick?: () => void;
  useIcon?: boolean;
  enableAddressTypeSelector?: boolean;
  activeAccount?: IAccountSelectorActiveAccountInfo;
}

export function BalanceDisplay({
  balance,
  token,
  isLoading = false,
  onBalanceClick,
  useIcon = false,
  enableAddressTypeSelector = false,
  activeAccount,
}: IBalanceDisplayProps) {
  const intl = useIntl();
  const [, setSelectedDeriveType] = useSelectedDeriveTypeAtom();

  const onSelect = useCallback(
    async (value: { account: any; deriveInfo: any; deriveType: any }) => {
      setSelectedDeriveType(value.deriveType);
      appEventBus.emit(EAppEventBusNames.NetworkDeriveTypeChanged, undefined);
    },
    [setSelectedDeriveType],
  );

  return (
    <XStack justifyContent="space-between" alignItems="center" height="$6">
      <InfoItemLabel
        title={intl.formatMessage({ id: ETranslations.global_balance })}
      />

      {isLoading ? (
        <Skeleton height="$3" width="$12" />
      ) : (
        <>
          <XStack
            alignItems="center"
            gap="$1"
            onPress={onBalanceClick}
            userSelect="none"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            borderRadius="$1"
            px="$1"
            py="$0.5"
          >
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="balance"
              formatterOptions={{
                tokenSymbol: useIcon ? undefined : token?.symbol,
              }}
              numberOfLines={1}
              maxWidth="$56"
            >
              {balance?.toFixed()}
            </NumberSizeableText>
            {useIcon ? (
              <Image
                size="$4"
                source={token?.logoURI}
                borderRadius="$full"
                fallback={
                  <Icon
                    name="CryptoCoinOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                }
              />
            ) : null}
          </XStack>
          {!!token && enableAddressTypeSelector ? (
            <AddressTypeSelector
              refreshOnOpen
              placement="bottom-start"
              networkId={token.networkId ?? ''}
              indexedAccountId={activeAccount?.indexedAccount?.id ?? ''}
              walletId={activeAccount?.wallet?.id ?? ''}
              onSelect={onSelect}
              renderSelectorTrigger={
                <DeriveTypeSelectorTriggerIconRenderer
                  autoShowLabel={false}
                  onPress={() => {}}
                  iconProps={{
                    size: '$4',
                  }}
                  labelProps={{
                    pl: '$1',
                  }}
                />
              }
            />
          ) : null}
        </>
      )}
    </XStack>
  );
}
