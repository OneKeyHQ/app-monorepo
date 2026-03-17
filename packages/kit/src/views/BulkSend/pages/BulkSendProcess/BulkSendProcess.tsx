import { Page, SizableText, YStack } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalBulkSendRoutes,
  IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';

function BulkSendProcess() {
  const _route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendProcess
  >();

  return (
    <Page>
      <Page.Header title="Bulk Send Process" />
      <Page.Body>
        <YStack p="$5" gap="$4" alignItems="center" justifyContent="center">
          <SizableText size="$headingLg">Bulk Send Process</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            Processing transactions...
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default BulkSendProcess;
