import { useCallback } from 'react';

import {
  ActionList,
  Badge,
  Dialog,
  Divider,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { usePrimeAuth } from '../../hooks/usePrimeAuth';

function PrimeUserInfoMoreButtonDropDownMenu({
  handleActionListClose,
}: {
  handleActionListClose: () => void;
}) {
  const { user, logout, updateEmail } = usePrimeAuth();
  // TODO: get isPrime from backend
  const isPrime = true;

  const userInfo = (
    <Stack px="$2" py="$2.5" gap="$1">
      <XStack alignItems="center" gap="$2">
        <SizableText flex={1} size="$headingSm">
          {user?.email}
        </SizableText>
        {isPrime ? (
          <Badge bg="$brand3" badgeSize="sm">
            <Badge.Text color="$brand11">Prime</Badge.Text>
          </Badge>
        ) : (
          <Badge badgeType="default" badgeSize="sm">
            Free
          </Badge>
        )}
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        Ends on December 31, 2023.
      </SizableText>
    </Stack>
  );
  return (
    <>
      {userInfo}
      <ActionList.Item
        label="Change email"
        icon="EmailOutline"
        onClose={handleActionListClose}
        onPress={() => updateEmail()}
      />
      <ActionList.Item
        label="Change password"
        icon="PasswordOutline"
        onClose={handleActionListClose}
      />
      <ActionList.Item
        label="Manage subscription"
        icon="CreditCardOutline"
        onClose={handleActionListClose}
        onPress={() => {
          if (user.subscriptionManageUrl) {
            openUrlUtils.openUrlExternal(user.subscriptionManageUrl);
          }
        }}
      />
      <Divider mx="$2" my="$1" />
      <ActionList.Item
        label="Log out"
        icon="LogoutOutline"
        onClose={handleActionListClose}
        onPress={() => {
          Dialog.show({
            icon: 'InfoCircleOutline',
            title: 'Log out',
            description: 'Are you sure you want to log out?',
            onConfirmText: 'Log out',
            onConfirm: () => logout(),
          });
        }}
      />
    </>
  );
}

export function PrimeUserInfoMoreButton() {
  const renderItems = useCallback(
    ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
      handleActionListOpen: () => void;
    }) => (
      <PrimeUserInfoMoreButtonDropDownMenu
        handleActionListClose={handleActionListClose}
      />
    ),
    [],
  );
  return (
    <ActionList
      title="Account"
      floatingPanelProps={{
        w: '$80',
      }}
      renderItems={renderItems}
      renderTrigger={
        <IconButton
          icon="DotHorOutline"
          variant="tertiary"
          size="small"
          onPress={() => {
            console.log('1');
          }}
        />
      }
    />
  );
}
