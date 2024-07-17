import { type IPageScreenProps, Page, SizableText } from '@onekeyhq/components';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

function ExportPrivateKeysPage() {
  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header />
      <Page.Body flexDirection="row">
        <SizableText>22</SizableText>
      </Page.Body>
    </Page>
  );
}

export default function ExportPrivateKeys({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.ExportPrivateKeysPage
>) {
  return <ExportPrivateKeysPage />;
}
