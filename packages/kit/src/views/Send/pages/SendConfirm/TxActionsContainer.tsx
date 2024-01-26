import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, SizableText, Stack, YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETxActionComponentType } from '@onekeyhq/shared/types';

import { Container } from '../../components/Container';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

function TxActionsContainer(props: IProps) {
  const { accountId, networkId, unsignedTxs } = props;
  const intl = useIntl();

  const isMultiTxs = useMemo(() => unsignedTxs.length > 1, [unsignedTxs]);

  const r = usePromiseResult(
    () =>
      Promise.all(
        unsignedTxs.map((unsignedTx) =>
          backgroundApiProxy.serviceSend.buildDecodedTx({
            accountId,
            networkId,
            unsignedTx,
          }),
        ),
      ),
    [accountId, networkId, unsignedTxs],
  );

  const renderActions = useCallback(() => {
    const decodedTxs = r.result ?? [];
    return decodedTxs.map((decodedTx, index) => (
      <Container.Box
        key={index}
        title={
          isMultiTxs
            ? `${intl.formatMessage({ id: 'form__transaction' })} #${index + 1}`
            : intl.formatMessage({ id: 'form__transaction' })
        }
      >
        <TxActionsListView
          componentType={ETxActionComponentType.DetailView}
          decodedTx={decodedTx}
        />
        <Divider />
        <Container.Item>
          <Stack>
            <SizableText textAlign="center" size="$bodyMd">
              Details & Settings
            </SizableText>
          </Stack>
        </Container.Item>
      </Container.Box>
    ));
  }, [intl, isMultiTxs, r.result]);

  return <YStack space="$2">{renderActions()}</YStack>;
}

export { TxActionsContainer };
