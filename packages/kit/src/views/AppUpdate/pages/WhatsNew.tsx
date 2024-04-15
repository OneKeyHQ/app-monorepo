import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Heading,
  Markdown,
  Page,
  ScrollView,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

function WhatsNew({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.WhatsNew>) {
  const { version = '', changeLog } = route.params || {};
  const { gtMd } = useMedia();
  return (
    <Page>
      <Page.Header title="App Update" />
      <Page.Body m="$5">
        <YStack space="$3">
          {gtMd ? (
            <Heading size="$heading2xl">{`What’s New in OneKey ${version} 👋🏻`}</Heading>
          ) : (
            <>
              <Heading size="$heading2xl">What’s New</Heading>
              <Heading size="$heading2xl">{`in OneKey ${version} 👋🏻`}</Heading>
            </>
          )}
        </YStack>
        {changeLog ? (
          <ScrollView
            mt="$7"
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$5' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
      </Page.Body>
      <Page.Footer
        onCancelText="I Got It"
        onCancel={(close) => {
          close();
        }}
      />
    </Page>
  );
}

export default WhatsNew;
