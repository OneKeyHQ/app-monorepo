import { useMemo } from 'react';

import {
  Button,
  Divider,
  Empty,
  ListView,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function ListHeaderComponent() {
  return (
    <SizableText px="$5" size="$bodyLg" color="$textSubdued">
      When modified, the custom RPC will replace OneKey’s node. To revert to
      OneKey’s node, disabled or delete the custom RPC.
    </SizableText>
  );
}

function ListEmptyComponent({
  onAddCustomRpc,
}: {
  onAddCustomRpc: () => void;
}) {
  return (
    <YStack testID="ListEmptyComponent-A">
      <Empty
        flex={1}
        icon="SearchOutline"
        title="No custom RPC"
        button={
          <Button
            mt="$6"
            size="medium"
            variant="primary"
            onPress={() => onAddCustomRpc()}
          >
            Add custom RPC
          </Button>
        }
      />
    </YStack>
  );
}

function CustomRPC() {
  const content = useMemo(() => [], []);

  return (
    <Page>
      <Page.Header title="Custom RPC" />
      <Page.Body>
        <ListView
          data={content}
          estimatedItemSize={60}
          keyExtractor={(item: string) => item}
          renderItem={({ item }) => (
            <ListItem>
              <SizableText>{item}</SizableText>
            </ListItem>
          )}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={<ListEmptyComponent onAddCustomRpc={() => {}} />}
        />
      </Page.Body>
    </Page>
  );
}

export default CustomRPC;
