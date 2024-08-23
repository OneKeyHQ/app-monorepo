import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import { assetChecker } from './assetCheck';

type IStakingListItemProps = {
  networkId: string;
  accountId: string;
  tokenAddress: string;
};

const AssetProtocolsContent = ({
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

const AssetProtocolsListItem = ({
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
  return <AssetProtocolsContent aprValue={4} onPress={onPress} />;
};

export const AssetProtocols = ({
  networkId,
  accountId,
  tokenAddress,
}: IStakingListItemProps) => {
  const result = useMemo(
    () => assetChecker({ networkId, tokenAddress }),
    [networkId, tokenAddress],
  );
  if (result) {
    return (
      <AssetProtocolsListItem
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
        symbol={result}
      />
    );
  }
  return null;
};
