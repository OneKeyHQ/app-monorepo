import { memo, useCallback, useMemo } from 'react';

import {
  Dialog,
  Input,
  Page,
  ScrollView,
  Toast,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

function PersonalInfoPageView() {
  const { user } = useOneKeyAuth();
  const isTabNavigator = useIsTabNavigator();

  const displayName = (user as { displayName?: string })?.displayName || '';

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

  const handleEditName = useCallback(() => {
    Dialog.confirm({
      title: 'Edit Name',
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: { name: displayName },
          }}
        >
          <Dialog.FormField
            name="name"
            rules={{
              required: {
                value: true,
                message: 'Name is required',
              },
              validate: (value: string) => {
                if (!value?.trim()) {
                  return 'Name is required';
                }
                return true;
              },
            }}
          >
            <Input autoFocus flex={1} placeholder="Enter your name" />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirm: async ({ getForm, close }) => {
        const form = getForm();
        const newName = form?.getValues().name;
        if (newName) {
          // TODO: Call API to update user name
          console.log('Update name to:', newName);
          await close();
          Toast.success({ title: 'Name updated' });
        }
      },
    });
  }, [displayName]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Personal information" />
      <Page.Body>
        <ScrollView contentContainerStyle={{ pb: '$10' }}>
          <YStack gap="$4" px="$4" pt={isTabNavigator ? undefined : '$3'}>
            <TabSettingsSection>
              <TabSettingsListItem
                icon="EditOutline"
                iconProps={iconProps}
                title="Name"
                titleProps={titleProps}
                userSelect="none"
                drillIn
                onPress={handleEditName}
              >
                <ListItem.Text
                  primaryTextProps={titleProps}
                  primary={displayName || 'Not set'}
                  align="right"
                />
              </TabSettingsListItem>
            </TabSettingsSection>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default memo(PersonalInfoPageView);
