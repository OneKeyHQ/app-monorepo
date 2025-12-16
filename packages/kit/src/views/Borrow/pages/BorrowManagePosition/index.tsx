import { Page, SizableText, YStack } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

const BorrowManagePosition = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowManagePosition
  >();

  const { symbol } = route.params;

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol || 'Manage Position'} />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$3">
          <SizableText size="$headingMd">Borrow Manage Position</SizableText>
          <SizableText size="$bodyMd">Hello World</SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default BorrowManagePosition;
