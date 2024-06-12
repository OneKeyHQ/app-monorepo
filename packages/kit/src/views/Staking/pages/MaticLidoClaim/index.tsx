import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ListView,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { ILidoMaticRequest } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useLidoMaticClaim } from '../../hooks/useLidoMaticHooks';
import { LIDO_MATIC_LOGO_URI } from '../../utils/const';

const LidoMaticClaimItem = ({
  item,
  networkId,
  accountId,
  token,
}: {
  item: ILidoMaticRequest;
  networkId: string;
  accountId: string;
  token: IToken;
}) => {
  const maticClaim = useLidoMaticClaim({ accountId, networkId });
  const [loading, setLoading] = useState(false);
  const intl = useIntl();
  return (
    <ListItem
      avatarProps={{ src: LIDO_MATIC_LOGO_URI, size: 32 }}
      title={`${item.amount} MATIC`}
    >
      <Button
        variant="primary"
        size="small"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            await maticClaim({
              tokenId: item.id,
              stakingInfo: {
                protocol: 'lido',
                tags: ['lido-matic'],
                receive: { token, amount: String(item.amount) },
              },
            });
          } finally {
            setLoading(false);
          }
        }}
      >
        {intl.formatMessage({ id: ETranslations.earn_claim })}
      </Button>
    </ListItem>
  );
};

const LidoMaticClaim = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoClaim
  >();
  const { accountId, networkId, requests, token } = appRoute.params;

  const renderItem = useCallback(
    ({ item }: { item: ILidoMaticRequest }) => (
      <LidoMaticClaimItem
        accountId={accountId}
        networkId={networkId}
        item={item}
        token={token}
      />
    ),
    [token, accountId, networkId],
  );

  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_claim })}
      />
      <Page.Body>
        <ListView
          estimatedItemSize="$5"
          data={requests}
          renderItem={renderItem}
          ListFooterComponent={
            <Stack px="$5">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.earn_claim_limitations,
                })}
              </SizableText>
            </Stack>
          }
        />
      </Page.Body>
    </Page>
  );
};

export default LidoMaticClaim;
