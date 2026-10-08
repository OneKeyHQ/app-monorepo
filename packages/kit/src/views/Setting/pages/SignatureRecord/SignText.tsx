import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Empty,
  IconButton,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  TextArea,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { ISignedMessage } from '@onekeyhq/shared/types/signatureRecord';

import { SETTINGS_PAGE_CONTENT_PADDING_X } from '../Tab/settingsSurface';

import { useGetSignatureSections } from './hooks';

const ListEmptyComponent = ({ onRetry }: { onRetry?: () => void }) => {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: onRetry
          ? ETranslations.global_an_error_occurred
          : ETranslations.settings_no_signed_text,
      })}
      description={intl.formatMessage({
        id: onRetry
          ? ETranslations.global_an_error_occurred_desc
          : ETranslations.settings_no_signed_text_desc,
      })}
      illustration={onRetry ? undefined : 'DocumentGlobe'}
      buttonProps={
        onRetry
          ? {
              children: intl.formatMessage({ id: ETranslations.global_retry }),
              onPress: onRetry,
              testID: 'signature-signed-text-retry',
            }
          : undefined
      }
    />
  );
};

const SignTextItem = ({ item }: { item: ISignedMessage }) => {
  const { copyText } = useClipboard();
  const onPress = useCallback(
    () => copyText(item.message),
    [item.message, copyText],
  );
  const primaryType = usePromiseResult(async () => {
    if (item.network.impl !== IMPL_EVM) {
      return null;
    }
    if (item.contentType === 'json') {
      try {
        const result = JSON.parse(item.message) as { primaryType?: string };
        if (result.primaryType) {
          return result.primaryType;
        }
      } catch {
        return null;
      }
    }
    return null;
  }, [item.contentType, item.message, item.network.impl]);

  return (
    <Stack px={SETTINGS_PAGE_CONTENT_PADDING_X} pb="$3">
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$3"
        borderColor="$borderSubdued"
        overflow="hidden"
      >
        <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
          <SizableText size="$bodyMd">
            {formatTime(new Date(item.createdAt), { hideSeconds: true })} •{' '}
            {item.title}
          </SizableText>
          <IconButton
            testID="setting-result-icon-btn"
            variant="tertiary"
            icon="Copy3Outline"
            size="small"
            onPress={onPress}
          />
        </XStack>
        <XStack justifyContent="space-between" p="$3">
          <TextArea
            testID="setting-textarea"
            maxHeight="$24"
            editable={false}
            scrollEnabled
            userSelect="none"
            value={
              item.contentType === 'json'
                ? JSON.stringify(JSON.parse(item.message), null, 2)
                : item.message
            }
            backgroundColor="transparent"
            width="100%"
            borderWidth={0}
          />
        </XStack>
        <XStack p="$3" alignItems="center" justifyContent="space-between">
          <XStack backgroundColor="$bgSubdued" alignItems="center">
            <Stack mr="$2">
              <NetworkAvatar size={16} networkId={item.networkId} />
            </Stack>
            <SizableText color="$textSubdued" size="$bodySmMedium">
              {utils.shortenAddress({ address: item.address })}
            </SizableText>
          </XStack>
          {primaryType.result ? (
            <Badge badgeType="info" badgeSize="sm">
              {primaryType.result}
            </Badge>
          ) : null}
        </XStack>
      </YStack>
    </Stack>
  );
};

type ISectionListData = {
  title: string;
  data: ISignedMessage[];
};

const keyExtractor = (item: unknown) => {
  const createdAt = (item as ISignedMessage)?.createdAt;
  return String(createdAt);
};

export const SignText = () => {
  const { sections, isLoading, hasError, onRetry, onEndReached } =
    useGetSignatureSections(async (params) =>
      backgroundApiProxy.serviceSignature.getSignedMessages(params),
    );

  const listEmptyComponent = hasError ? (
    <ListEmptyComponent onRetry={onRetry} />
  ) : (
    ListEmptyComponent
  );

  return (
    <Tabs.SectionList
      windowSize={platformEnv.isNativeAndroid ? 3 : undefined}
      stickySectionHeadersEnabled={false}
      sections={sections}
      keyExtractor={keyExtractor}
      // estimatedItemSize={191}
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          px={SETTINGS_PAGE_CONTENT_PADDING_X}
          title={(section as ISectionListData).title}
        />
      )}
      renderItem={({ item }) => <SignTextItem item={item} />}
      ListEmptyComponent={
        isLoading ? (
          <Skeleton.Group show>
            <YStack px={SETTINGS_PAGE_CONTENT_PADDING_X} pt="$3" gap="$3">
              <Skeleton w="100%" h="$24" />
              <Skeleton w="100%" h="$24" />
            </YStack>
          </Skeleton.Group>
        ) : (
          listEmptyComponent
        )
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
