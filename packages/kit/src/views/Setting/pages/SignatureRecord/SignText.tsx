import { useCallback, useContext, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Empty,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  TextArea,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { ISignedMessage } from '@onekeyhq/shared/types/signatureRecord';

import { SignatureContext } from './Context';
import { groupBy } from './utils';

const ListEmptyComponent = () => (
  <Empty
    title="No Signed Text"
    description="All text signed through OneKey will appear here"
    icon="ClockAlertOutline"
  />
);

const SignTextItem = ({ item }: { item: ISignedMessage }) => {
  const { copyText } = useClipboard();
  const onPress = useCallback(
    () => copyText(item.message),
    [item.message, copyText],
  );
  return (
    <YStack
      borderWidth={StyleSheet.hairlineWidth}
      mx="$5"
      borderRadius="$3"
      borderColor="$borderSubdued"
      overflow="hidden"
      mb="$3"
    >
      <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
        <SizableText size="$bodyMd">
          {formatTime(new Date(item.createdAt), { hideSeconds: true })} •{' '}
          {item.title}
        </SizableText>
        <IconButton
          variant="tertiary"
          icon="Copy1Outline"
          size="small"
          onPress={onPress}
        />
      </XStack>
      <XStack justifyContent="space-between" p="$3">
        {item.contentType === 'json' ? (
          <TextArea
            maxHeight="$24"
            disabled
            value={JSON.stringify(JSON.parse(item.message), null, 2)}
            backgroundColor="transparent"
            width="100%"
            borderWidth={0}
          />
        ) : (
          <SizableText maxHeight="$24" size="$bodyLgMedium">
            {item.message}
          </SizableText>
        )}
      </XStack>
      <XStack p="$3" backgroundColor="$bgSubdued" alignItems="center">
        <Stack mr="$2">
          <NetworkAvatar size={16} networkId={item.networkId} />
        </Stack>
        <SizableText color="$textSubdued">
          {item.network.name}
          {' • '}
          {utils.shortenAddress({ address: item.address })}
        </SizableText>
      </XStack>
    </YStack>
  );
};

type ISectionListData = {
  title: string;
  data: ISignedMessage[];
};

export const SignText = () => {
  const [limit, setLimit] = useState<number>(10);
  const { networkId } = useContext(SignatureContext);
  const {
    result: { sections, len },
  } = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceSignature.getSignedMessages({
          limit,
          networkId,
          offset: 0,
        });
      return { sections: groupBy(result), len: result.length };
    },
    [networkId, limit],
    { initResult: { sections: [], len: 0 } },
  );

  const onEndReached = useCallback(() => {
    if (len < limit) {
      return;
    }
    setLimit((prev) => prev + 10);
  }, [len, limit]);

  return (
    <SectionList
      sections={sections}
      estimatedItemSize="$36"
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          title={(section as ISectionListData).title}
        />
      )}
      renderItem={({ item }) => <SignTextItem item={item} />}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
