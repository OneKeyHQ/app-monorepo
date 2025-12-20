import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

export interface IAddressListItemProps {
  address: string;
  addressType?: string;
  accountName?: string;
  isLocal?: boolean;
  showType?: boolean;
  showAccount?: boolean;
  showHierarchyIndicator?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  memo?: string;
  note?: string;
}

function AddressListItem(props: IAddressListItemProps) {
  const {
    isLocal,
    showType,
    showAccount,
    showHierarchyIndicator,
    accountName,
    addressType,
    address,
    onPress,
    disabled,
    memo,
    note,
  } = props;

  const intl = useIntl();

  const shouldDisplayAccount = showAccount && !!accountName;
  const shouldDisplayType = showType && !!addressType;
  const shouldDisplayHierarchyIndicator =
    showHierarchyIndicator && shouldDisplayAccount;

  return (
    <YStack
      gap="$1"
      px="$5"
      py="$2"
      minHeight="$11"
      justifyContent="center"
      onPress={onPress}
      {...(onPress &&
        !disabled && {
          userSelect: 'none',
          ...listItemPressStyle,
        })}
    >
      {shouldDisplayAccount ? (
        <SizableText size="$bodyMd" color="$textPrimary" numberOfLines={1}>
          {accountName}
        </SizableText>
      ) : null}
      <XStack gap="$1">
        {showHierarchyIndicator ? (
          <Icon
            size="$4"
            name="ArrowCornerDownRightSolid"
            color="$iconSubdued"
          />
        ) : null}
        <YStack gap="$1" flex={1}>
          {shouldDisplayType ? (
            <XStack>
              <Badge badgeSize="sm" badgeType="default">
                {addressType}
              </Badge>
            </XStack>
          ) : null}
          <SizableText
            size="$bodySm"
            color={isLocal ? '$textSubdued' : '$text'}
            flex={1}
            flexWrap="wrap"
          >
            {address}
          </SizableText>
          {memo || note ? (
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexWrap="wrap"
              flex={1}
            >
              {`${intl.formatMessage({
                id: note ? ETranslations.global_Note : ETranslations.send_tag,
              })}: ${memo || note || ''}`}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}

export { AddressListItem };
