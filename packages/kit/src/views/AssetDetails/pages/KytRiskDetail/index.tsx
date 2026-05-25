import { useRoute } from '@react-navigation/core';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';

import type { RouteProp } from '@react-navigation/core';

function KytRiskDetail() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.KytRiskDetail
      >
    >();

  const { symbol } = route.params;

  return (
    <Page>
      <Page.Header title={`${symbol} risk detail`} />
      <Page.Body>
        <Stack flex={1} ai="center" jc="center" p="$5">
          <SizableText size="$bodyLg" color="$textSubdued">
            Risk detail content coming soon
          </SizableText>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default KytRiskDetail;
