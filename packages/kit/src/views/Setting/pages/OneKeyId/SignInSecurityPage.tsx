import { memo, useCallback, useMemo } from 'react';

import {
  Dialog,
  Divider,
  Input,
  Page,
  ScrollView,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

function SignInSecurityPageView() {
  const { user } = useOneKeyAuth();
  const isTabNavigator = useIsTabNavigator();

  const email = (user as { email?: string })?.email || '';

  const titleProps = useMemo(
    () => ({
      size: (isTabNavigator
        ? '$bodyMdMedium'
        : '$bodyLgMedium') as ISizableTextProps['size'],
    }),
    [isTabNavigator],
  );

  const iconProps = useMemo(
    () => ({
      size: (isTabNavigator ? '$5' : '$6') as IIconProps['size'],
    }),
    [isTabNavigator],
  );

  const handleEditEmail = useCallback(() => {
    Dialog.confirm({
      title: 'Edit Email',
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: { email },
          }}
        >
          <Dialog.FormField
            name="email"
            rules={{
              required: {
                value: true,
                message: 'Email is required',
              },
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            }}
          >
            <Input autoFocus flex={1} placeholder="Enter your email" />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm, close }) => {
        const form = getForm();
        const newEmail = form?.getValues().email;
        if (newEmail) {
          // TODO: Call API to update user email
          console.log('Update email to:', newEmail);
          await close();
          Toast.success({ title: 'Email updated' });
        }
      },
    });
  }, [email]);

  const handleChangePassword = useCallback(() => {
    // TODO: Navigate to change password flow
    console.log('Change password');
  }, []);

  const handleTwoFactorAuth = useCallback(() => {
    // TODO: Navigate to 2FA settings
    console.log('Two-factor authentication');
  }, []);

  // TODO: Get actual last changed date from API
  const passwordLastChanged = 'Last changed April 24, 2023';

  return (
    <Page scrollEnabled>
      <Page.Header title="Sign-In & Security" />
      <Page.Body>
        <ScrollView contentContainerStyle={{ pb: '$10' }}>
          <YStack gap="$4" px="$4" pt={isTabNavigator ? undefined : '$3'}>
            {/* Email Section */}
            <TabSettingsSection>
              <TabSettingsListItem
                icon="EmailOutline"
                iconProps={iconProps}
                title="Email"
                titleProps={titleProps}
                drillIn
                onPress={handleEditEmail}
              >
                <ListItem.Text
                  primaryTextProps={titleProps}
                  primary={email || 'Not set'}
                  align="right"
                />
              </TabSettingsListItem>
            </TabSettingsSection>

            {/* Password & 2FA Section */}
            <TabSettingsSection>
              <TabSettingsListItem
                icon="KeyOutline"
                iconProps={iconProps}
                title="Password"
                subtitle={passwordLastChanged}
                titleProps={titleProps}
                drillIn
                onPress={handleChangePassword}
              />
              <XStack mx="$5">
                <Divider borderColor="$neutral3" />
              </XStack>
              <TabSettingsListItem
                icon="ShieldCheckDoneOutline"
                iconProps={iconProps}
                title="Two-Factor Authentication"
                subtitle="Your phone numbers are used to verify your identity when signing in."
                titleProps={titleProps}
                drillIn
                onPress={handleTwoFactorAuth}
              />
            </TabSettingsSection>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default memo(SignInSecurityPageView);
