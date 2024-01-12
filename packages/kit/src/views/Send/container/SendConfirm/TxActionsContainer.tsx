import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, SizableText, Stack, YStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { TxActionsListView } from '../../../../components/TxActionListView';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { useUnsignedTxsAtom } from '../../../../states/jotai/contexts/send-confirm';
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
