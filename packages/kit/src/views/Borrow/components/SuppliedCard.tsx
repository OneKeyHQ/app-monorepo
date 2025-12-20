import { useCallback } from 'react';

import { XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useSupplyActions } from '../hooks/useSupplyActions';

import {
  ActionField,
  AmountField,
  AssetField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];

const SuppliedHeader = ({
  data,
}: {
  data?: IBorrowReserveItem['supplied'];
}) => {
  return (
    <XStack mt="$3" mb="$5" px="$5" gap="$5">
      {data?.suppliedBalance?.title ? (
        <XStack gap="$1">
          <EarnText
            text={{
              text: 'Supplied balance',
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedBalance?.title} />
        </XStack>
      ) : null}
      {data?.suppliedApy?.title ? (
        <XStack gap="$1">
          <EarnText
            text={{
              text: 'APY',
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedApy?.title} />
        </XStack>
      ) : null}
    </XStack>
  );
};

export const SuppliedCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const handleManageWithdraw = useCallback(
    (item: ISuppliedAsset) => {
      if (!market) return;

      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId: activeAccount.account?.id || '',
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
        type: EManagePositionType.Withdraw,
      });
    },
    [navigation, market, activeAccount.account?.id],
  );

  const showLoading = !reserves && reservesLoading;

  // FIXME[borrow]: i18n
  return (
    <Card title="Your supplies">
      {/* FIXME[borrow]: i18n */}
      {!showLoading ? <SuppliedHeader data={reserves?.supplied} /> : null}
      <BorrowTableList<ISuppliedAsset>
        data={reserves?.supplied.assets || []}
        isLoading={showLoading}
        columns={[
          {
            label: 'Asset', // FIXME[borrow]: i18n
            key: 'asset',
            render: AssetField,
            flex: 1,
          },
          {
            label: 'Supplied',
            align: 'flex-end',
            key: 'supplied',
            render: (item) => (
              <AmountField
                title={item.suppliedAmount.title}
                description={item.suppliedAmount.description}
              />
            ),
            flex: 1,
          },
          {
            label: 'Supply APY',
            align: 'flex-end',
            key: 'supplyApy',
            render: BorrowAPYField,
            flex: 1,
          },
          {
            label: '',
            align: 'flex-end',
            key: 'actions',
            render: (item) => (
              <ActionField
                buttonText={<EarnText text={{ text: 'Withdraw' }} />}
                item={item}
                onPress={() => handleManageWithdraw(item)}
              />
            ),
            flex: 1,
          },
        ]}
        emptyContent="Nothing supplied yet" // FIXME[borrow]: i18n
      />
    </Card>
  );
};
