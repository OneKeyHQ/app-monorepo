import { useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IButtonProps,
  IKeyOfIcons,
  IPageScreenProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Button,
  Divider,
  Group,
  Heading,
  Icon,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Spinner,
  Stack,
  ThemeableStack,
  XStack,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

type IActionsGroupItem = {
  iconName: IKeyOfIcons;
  label: string;
  primary?: boolean;
  isLoading?: boolean;
} & IXStackProps;

type IActionsProp = {
  items: IActionsGroupItem[];
};

function ActionsGroup({ items }: IActionsProp) {
  return (
    <Group
      borderRadius="$3"
      $gtMd={{
        borderRadius: '$2',
      }}
      separator={<Divider />}
    >
      {items.map((item: IActionsGroupItem, index) => (
        <Group.Item key={index}>
          <XStack
            flexDirection="row"
            py="$3.5"
            px="$4"
            bg={item.primary ? '$bgPrimary' : '$bgStrong'}
            $gtMd={{
              py: '$2',
            }}
            hoverStyle={{
              bg: item.primary ? '$bgPrimaryHover' : '$bgStrongHover',
            }}
            pressStyle={{
              bg: item.primary ? '$bgPrimaryActive' : '$bgStrongActive',
            }}
            focusStyle={{
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
            focusable
            userSelect="none"
            borderCurve="continuous"
            onPress={item.onPress}
            testID={item.testID}
          >
            <Icon
              name={item.iconName}
              color={item.primary ? '$iconInverse' : '$icon'}
            />
            <SizableText
              pl="$3"
              size="$bodyLgMedium"
              color={item.primary ? '$textInverse' : '$text'}
            >
              {item.label}
            </SizableText>
            {item?.isLoading ? (
              <XStack ml="$2">
                <Spinner />
              </XStack>
            ) : null}
          </XStack>
        </Group.Item>
      ))}
    </Group>
  );
}

export function V4MigrationGetStarted({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const shouldPreventV4MigrationModalClose = false; // use atom set false after migration done
  usePreventRemove(shouldPreventV4MigrationModalClose, () => null);

  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateToV4MigrationPreview = async () => {
    try {
      setIsLoading(true);
      const res =
        await backgroundApiProxy.serviceV4Migration.prepareMigration();
      if (res.shouldBackup) {
        navigation.push(EOnboardingPages.V4MigrationPreview);
      } else {
        // navigate to process page directly
        navigation.push(EOnboardingPages.V4MigrationProcess);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body flex={1} justifyContent="center" alignItems="center">
        <Image
          w={360}
          h={360}
          source={require('@onekeyhq/kit/assets/logo-press.png')}
        />
        <Stack p="$5" pb="$0" mt="$-16" maxWidth="$96">
          <LinearGradient
            position="absolute"
            top="$0"
            left="$0"
            right="$0"
            bottom="$0"
            colors={['transparent', '$bgApp']}
            $platform-native={{
              display: 'none',
            }}
          />
          <Stack zIndex={1}>
            <Heading size="$heading4xl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.v4_migration_welcome_message,
              })}
            </Heading>
            <SizableText
              mt="$3"
              size="$bodyLg"
              textAlign="center"
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.v4_migration_welcome_message_desc,
              })}
            </SizableText>
          </Stack>
        </Stack>
        <Button
          mt="$8"
          size="large"
          $gtMd={
            {
              size: 'medium',
            } as IButtonProps
          }
          variant="primary"
          loading={isLoading}
          onPress={handleNavigateToV4MigrationPreview}
        >
          {intl.formatMessage({ id: ETranslations.global_start_migration })}
        </Button>
      </Page.Body>
    </Page>
  );
}

export default V4MigrationGetStarted;
