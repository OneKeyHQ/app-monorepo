import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  SectionList,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETokenSelectorSyntheticRowType } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';

export function CrossNetworkSearchSyntheticRow({
  rowType,
  currentNetworkName,
  onRetry,
}: {
  rowType: ETokenSelectorSyntheticRowType;
  currentNetworkName: string;
  onRetry?: () => void;
}) {
  const intl = useIntl();

  switch (rowType) {
    case ETokenSelectorSyntheticRowType.CurrentNetworkHeader:
      return <SectionList.SectionHeader title={currentNetworkName} />;
    case ETokenSelectorSyntheticRowType.OtherNetworksHeader:
      // 20px gap between the current-network section (token rows or the
      // collapsed no-match line) and this section.
      return (
        <SectionList.SectionHeader
          title={intl.formatMessage({
            id: ETranslations.token_selector_other_networks__title,
          })}
          mt="$5"
        />
      );
    case ETokenSelectorSyntheticRowType.CurrentNetworkNoMatch:
      return (
        <XStack h="$9" px="$5" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              {
                id: ETranslations.token_selector_no_match_on_network__desc,
              },
              { network: currentNetworkName },
            )}
          </SizableText>
        </XStack>
      );
    case ETokenSelectorSyntheticRowType.OtherNetworksSearchError:
      return (
        <XStack px="$5" py="$2" alignItems="center" gap="$3">
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.token_selector_other_networks_search_failed__msg,
            })}
          </SizableText>
          <Button
            testID="TokenSelector-CrossNetworkSearch-InlineRetry"
            size="small"
            onPress={onRetry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </XStack>
      );
    default:
      return null;
  }
}

// Selector search error state — used for ANY selector search (single-network
// cross-network mode AND All Networks). The no-result counterpart reuses
// `EmptyToken` with a title override; this one cannot, because it needs a
// different illustration plus a description and a retry button.
export function TokenSelectorSearchErrorView({
  onRetry,
  ...rest
}: IYStackProps & { onRetry?: () => void }) {
  const intl = useIntl();
  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="TokenSelector-Search-Error"
      illustration="GlobeError"
      title={intl.formatMessage({
        id: ETranslations.token_selector_search_failed__title,
      })}
      description={intl.formatMessage({
        id: ETranslations.token_selector_search_failed__desc,
      })}
      buttonProps={{
        children: intl.formatMessage({ id: ETranslations.global_retry }),
        onPress: onRetry,
      }}
      {...rest}
    />
  );
}
