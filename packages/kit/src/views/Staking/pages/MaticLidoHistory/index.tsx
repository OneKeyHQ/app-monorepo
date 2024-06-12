import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { LidoHistory } from '../../components/LidoHistory';
import { PageFrame } from '../../components/PageFrame';
import { HistorySkeleton } from '../../components/StakingSkeleton';

const LidoMaticHistory = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.MaticLidoHistory
  >();
  const { networkId, accountId } = appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getLidoMaticHistory({
        networkId,
        accountId,
      }),
    [networkId, accountId],
    { watchLoading: true },
  );
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_history })}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={HistorySkeleton}
          loading={Boolean(result === undefined && isLoading === true)}
          error={Boolean(result === undefined && isLoading === false)}
          onRefresh={run}
        >
          <LidoHistory items={result ?? []} />
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default LidoMaticHistory;
