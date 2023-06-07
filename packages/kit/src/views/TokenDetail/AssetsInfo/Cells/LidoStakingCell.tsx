import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Image,
  ListItem,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import LidoLogoPNG from '@onekeyhq/kit/assets/staking/lido_pool.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../../components/Format';
import { useAccountTokensBalance, useNavigation } from '../../../../hooks';
import { useSingleToken } from '../../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { useLidoOverview } from '../../../Staking/hooks';
import { StakingRoutes } from '../../../Staking/typing';
import { getLidoTokenEvmAddress } from '../../../Staking/utils';
import { formatAmount } from '../../../Swap/utils';
import { PriceCurrencyNumber } from '../../TokenDetailHeader/PriceCurrencyNumber';

import type { TokenBalanceValue } from '../../../../store/reducers/tokens';

type CellProps = {
  token: TokenDO | undefined;
  networkId: string;
  amount: string;
  balances: Record<string, TokenBalanceValue>;
  onPress?: () => void;
};

const Mobile: FC<CellProps> = ({
  amount,
  token,
  balances,
  networkId,
  onPress,
}) => {
  const intl = useIntl();

  return (
    <ListItem mx="-8px" onPress={onPress}>
      <ListItem.Column>
        <Box flexDirection="row">
          <Image
            width="40px"
            height="40px"
            overflow="hidden"
            borderRadius="full"
            source={LidoLogoPNG}
          />
          <Box />
        </Box>
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: 'Lidopool',
          labelProps: { typography: 'Body1Strong' },
          description: (
            <FormatBalance
              balance={formatAmount(amount, 6)}
              suffix={token?.symbol}
              formatOptions={{
                fixed: token?.decimals ?? 4,
              }}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          ),
        }}
      />
      <ListItem.Column
        flex={1}
        alignItems="flex-end"
        text={{
          label: (
            <Typography.Body1Strong>
              <PriceCurrencyNumber
                networkId={networkId}
                token={token}
                contractAdress={token?.tokenIdOnNetwork}
                balances={balances}
              />
            </Typography.Body1Strong>
          ),
          description: (
            <Box>
              <Badge
                size="sm"
                type="info"
                title={intl.formatMessage({ id: 'form__staking' })}
              />
            </Box>
          ),
        }}
      />
    </ListItem>
  );
};

const Desktop: FC<CellProps> = ({
  amount,
  token,
  balances,
  networkId,
  onPress,
}) => {
  const intl = useIntl();

  return (
    <>
      <Box borderBottomWidth={1} borderColor="divider" />
      <ListItem mx="-8px" py={4} onPress={onPress}>
        <HStack flex={3} space="12px" alignItems="center">
          <Image source={LidoLogoPNG} w="32px" h="32px" />
          <Typography.Body1Strong>Lidopool</Typography.Body1Strong>
        </HStack>
        <Box flex={1} flexDirection="row" justifyContent="flex-end">
          <Badge
            size="sm"
            type="info"
            title={intl.formatMessage({ id: 'form__staking' })}
          />
        </Box>
        <ListItem.Column
          flex={2.5}
          text={{
            label: (
              <Typography.Body1Strong textAlign="right">
                {formatAmount(amount, 6)} stETH
              </Typography.Body1Strong>
            ),
          }}
        />
        <ListItem.Column
          flex={2.5}
          text={{
            label: (
              <Typography.Body1Strong textAlign="right">
                <PriceCurrencyNumber
                  networkId={networkId}
                  token={token}
                  contractAdress={token?.tokenIdOnNetwork}
                  balances={balances}
                />
              </Typography.Body1Strong>
            ),
          }}
        />
      </ListItem>
    </>
  );
};

type LidoEthCellProps = {
  sendAddress?: string;
  tokenId: string;
};

const LidoEthCell: FC<LidoEthCellProps> = ({ tokenId, sendAddress }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const navigation = useNavigation();
  const balances = useAccountTokensBalance(networkId, accountId);
  const { token } = useSingleToken(networkId, tokenId);
  const isVerticalLayout = useIsVerticalLayout();

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnLido,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);

  let balanceKey = getBalanceKey({ ...token, sendAddress });
  balanceKey = balanceKey.toLowerCase();

  const { balance: amount } = balances[balanceKey] ?? { balance: '0' };

  const props = useMemo(
    () => ({
      amount,
      balances,
      networkId,
      token,
      onPress,
    }),
    [amount, balances, networkId, token, onPress],
  );

  return isVerticalLayout ? <Mobile {...props} /> : <Desktop {...props} />;
};

type LidoEthCellControlProps = {
  sendAddress?: string;
  token: TokenDO | undefined;
};

const LidoEthCellControl: FC<LidoEthCellControlProps> = ({
  token,
  sendAddress,
}) => {
  const lidoAddress = getLidoTokenEvmAddress(
    token?.networkId,
    token?.tokenIdOnNetwork,
  );
  const { accountId, networkId } = useActiveWalletAccount();
  const lidoOverview = useLidoOverview(networkId, accountId);

  useEffect(() => {
    if (!lidoOverview?.balance) {
      backgroundApiProxy.serviceStaking.fetchLidoOverview({
        accountId,
        networkId,
      });
    }
    //  eslint-disable-next-line
  }, [])

  return lidoAddress &&
    lidoOverview?.balance &&
    Number(lidoOverview?.balance) > 0 ? (
    <LidoEthCell tokenId={lidoAddress} sendAddress={sendAddress} />
  ) : null;
};

export default LidoEthCellControl;
