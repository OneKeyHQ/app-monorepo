import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, SizableText, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';

import { Container } from '../../components/Container';

function TxActionsContainer() {
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();

  const isMultiTxs = useMemo(() => unsignedTxs.length > 1, [unsignedTxs]);

  const r = usePromiseResult(
    () =>
      Promise.all(
        unsignedTxs.map(() =>
          backgroundApiProxy.serviceSend.demoBuildDecodedTx(),
        ),
      ),
    [unsignedTxs],
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
        <TxActionsListView componentType="T1" decodedTx={decodedTx} />
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
