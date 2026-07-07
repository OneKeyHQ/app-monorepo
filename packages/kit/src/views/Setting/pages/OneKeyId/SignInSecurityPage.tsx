import {
  createRef,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import {
  Dialog,
  Divider,
  Input,
  Page,
  ScrollView,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

type IEditEmailDialogContentRef = {
  getEmail: () => string;
  showError: (message: string) => void;
};

const EDIT_EMAIL_DIALOG_ESTIMATED_CONTENT_HEIGHT = 76;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EditEmailDialogContent = forwardRef<
  IEditEmailDialogContentRef,
  { initialValue: string }
>(function EditEmailDialogContent({ initialValue }, ref) {
  const [email, setEmail] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useImperativeHandle(
    ref,
    () => ({
      getEmail: () => email,
      showError: setErrorMessage,
    }),
    [email],
  );

  return (
    <>
      <Input
        autoFocus
        flex={1}
        placeholder="Enter your email"
        testID="setting-handle-edit-email-input"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrorMessage(undefined);
        }}
      />
      {errorMessage ? (
        <SizableText size="$bodyMd" pt="$1.5" color="$textCritical">
          {errorMessage}
        </SizableText>
      ) : null}
    </>
  );
});

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
    const contentRef = createRef<IEditEmailDialogContentRef>();

    Dialog.confirm({
      title: 'Edit Email',
      renderContent: (
        <EditEmailDialogContent ref={contentRef} initialValue={email} />
      ),
      estimatedContentHeight: EDIT_EMAIL_DIALOG_ESTIMATED_CONTENT_HEIGHT,
      onConfirm: async ({ close, preventClose }) => {
        const newEmail = contentRef.current?.getEmail().trim() ?? '';
        if (!newEmail) {
          preventClose();
          contentRef.current?.showError('Email is required');
          return;
        }
        if (!EMAIL_PATTERN.test(newEmail)) {
          preventClose();
          contentRef.current?.showError('Invalid email format');
          return;
        }

        // TODO: Call API to update user email
        console.log('Update email to:', newEmail);
        await close();
        Toast.success({ title: 'Email updated' });
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
