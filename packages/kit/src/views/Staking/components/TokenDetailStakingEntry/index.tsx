import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

type IStakingListItemProps = {
  networkId: string;
  accountId: string;
  tokenAddress: string;
};

const StakingEntryListItemContent = ({
  aprValue,
  onPress,
}: {
  aprValue: string | number;
  onPress: () => void;
}) => {
  const intl = useIntl();
  return (
    <>
      <ListItem
        drillIn
        onPress={onPress}
        py="$3"
        px="$5"
        mx="$0"
        bg="$bgSuccessSubdued"
        hoverStyle={{ bg: '$bgSuccess' }}
        pressStyle={{ bg: '$bgSuccess' }}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$0"
      >
        <Stack p="$3" borderRadius="$full" bg="$bgSuccess">
          <Icon name="ChartColumnar3Outline" color="$iconSuccess" />
        </Stack>
        <ListItem.Text
          flex={1}
          primary="新质押入口"
          secondary={intl.formatMessage(
            { id: ETranslations.earn_up_to_number_in_annual_rewards },
            { number: `${aprValue}%` },
          )}
          secondaryTextProps={{
            size: '$bodyMdMedium',
            color: '$textSuccess',
          }}
        />
      </ListItem>
    </>
  );
};

const StakingEntryListItem = ({
  networkId,
  accountId,
  symbol,
}: IStakingListItemProps & { symbol: string }) => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.AssetProtocolList,
      params: { networkId, accountId, symbol },
    });
  }, [navigation, networkId, accountId, symbol]);
  return <StakingEntryListItemContent aprValue={4} onPress={onPress} />;
};

export const TokenDetailStakingEntry = ({
  networkId,
  accountId,
  tokenAddress,
}: IStakingListItemProps) => {
  const { result } = usePromiseResult(async () => {
    const symbolInfo =
      await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
        networkId,
        tokenAddress,
      });
    return symbolInfo;
  }, [networkId, tokenAddress]);
  if (result) {
    return (
      <StakingEntryListItem
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
        symbol={result.symbol}
      />
    );
  }
  return null;
};
