import { useCallback } from 'react';

import { ListView, Page, SizableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { ILidoMaticRequest } from '@onekeyhq/shared/types/staking';

import { useLidoMaticClaim } from '../../hooks/useLidoMaticHooks';
import { LIDO_MATIC_LOGO_URI } from '../../utils/const';

const LidoMaticClaim = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoClaim
  >();
  const { accountId, networkId, requests, token } = appRoute.params;
  const maticClaim = useLidoMaticClaim({ accountId, networkId });

  const renderItem = useCallback(
    ({ item }: { item: ILidoMaticRequest }) => (
      <ListItem
        avatarProps={{ src: LIDO_MATIC_LOGO_URI, size: 32 }}
        title={`${item.amount} MATIC`}
        drillIn
        onPress={() =>
          maticClaim({
            tokenId: item.id,
            stakingInfo: {
              protocol: 'lido',
              tags: ['lido-matic'],
              receive: { token, amount: String(item.amount) },
            },
          })
        }
      />
    ),
    [maticClaim, token],
  );

  return (
    <Page>
      <Page.Header title="Claim" />
      <Page.Body>
        <ListView
          estimatedItemSize="$5"
          data={requests}
          renderItem={renderItem}
          ListFooterComponent={
            <Stack px="$5">
              <SizableText size="$bodySm" color="$textSubdued">
                Due to the limitations of Lido, you must claim each of your
                unstakes separately.
              </SizableText>
            </Stack>
          }
        />
      </Page.Body>
    </Page>
  );
};

export default LidoMaticClaim;
