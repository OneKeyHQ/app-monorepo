import {
  Badge,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
  } = props;

  const shouldDisplayAccount = showAccount && !!accountName;
  const shouldDisplayType = showType && !!addressType;
  const shouldDisplayHierarchyIndicator =
    showHierarchyIndicator && shouldDisplayAccount;

  return (
    <YStack
      gap="$1"
      px="$5"
      py="$2"
      borderCurve="continuous"
      onPress={onPress}
      {...(onPress && !disabled && listItemPressStyle)}
    >
      {shouldDisplayAccount ? (
        <SizableText size="$bodyMd" color="$textPrimary">
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
        <YStack
          gap="$1"
          ml={
            shouldDisplayHierarchyIndicator || !shouldDisplayAccount ? 0 : '$5'
          }
        >
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
          >
            {address}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}

export { AddressListItem };
