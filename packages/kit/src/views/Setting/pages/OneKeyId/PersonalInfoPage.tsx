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
  Input,
  Page,
  ScrollView,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

type IEditNameDialogContentRef = {
  getName: () => string;
  showError: (message: string) => void;
};

const EDIT_NAME_DIALOG_ESTIMATED_CONTENT_HEIGHT = 76;

const EditNameDialogContent = forwardRef<
  IEditNameDialogContentRef,
  { initialValue: string }
>(function EditNameDialogContent({ initialValue }, ref) {
  const [name, setName] = useState(initialValue);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useImperativeHandle(
    ref,
    () => ({
      getName: () => name,
      showError: setErrorMessage,
    }),
    [name],
  );

  return (
    <>
      <Input
        autoFocus
        flex={1}
        placeholder="Enter your name"
        testID="setting-handle-edit-name-input"
        value={name}
        onChangeText={(value) => {
          setName(value);
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
    const contentRef = createRef<IEditNameDialogContentRef>();

    Dialog.confirm({
      title: 'Edit Name',
      renderContent: (
        <EditNameDialogContent ref={contentRef} initialValue={displayName} />
      ),
      estimatedContentHeight: EDIT_NAME_DIALOG_ESTIMATED_CONTENT_HEIGHT,
      onConfirm: async ({ close, preventClose }) => {
        const newName = contentRef.current?.getName().trim() ?? '';
        if (!newName) {
          preventClose();
          contentRef.current?.showError('Name is required');
          return;
        }

        // TODO: Call API to update user name
        console.log('Update name to:', newName);
        await close();
        Toast.success({ title: 'Name updated' });
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
