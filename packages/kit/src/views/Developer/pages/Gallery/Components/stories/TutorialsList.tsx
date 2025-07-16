import { Button, Toast, YStack } from '@onekeyhq/components';
import {
  OrderedList,
  TutorialsList,
} from '@onekeyhq/kit/src/components/TutorialsList/TutorialsList';

import { Layout } from './utils/Layout';

const TutorialsListGallery = () => (
  <Layout
    componentName="TutorialsList / OrderedList"
    filePath={require.resolve(
      '@onekeyhq/kit/src/components/TutorialsList/TutorialsList',
    )}
    description="A component for displaying numbered tutorial steps with titles, descriptions, and optional children content. Available as both TutorialsList and OrderedList (alias)."
    suggestions={[
      'Use for step-by-step tutorials or guides',
      'Each tutorial item can have a title, description, and custom content',
      'Automatically numbers the steps starting from 1',
      'Supports custom styling through Stack props',
      'Can be imported as either TutorialsList or OrderedList',
    ]}
    boundaryConditions={[
      'The tutorials array should not be empty',
      'Each tutorial item should have at least a title',
      'Custom children content is optional but can be used for interactive elements',
    ]}
    elements={[
      {
        title: 'Basic Tutorial List',
        description: 'Simple tutorial list with titles and descriptions',
        element: (
          <YStack gap="$4">
            <TutorialsList
              tutorials={[
                {
                  title: 'Create your wallet',
                  description: 'Set up a new wallet to get started',
                },
                {
                  title: 'Add accounts',
                  description: 'Add accounts for different cryptocurrencies',
                },
                {
                  title: 'Make your first transaction',
                  description: 'Send or receive cryptocurrency',
                },
              ]}
            />
          </YStack>
        ),
      },
      {
        title: 'Tutorial List with Custom Children',
        description: 'Tutorial list with interactive elements',
        element: (
          <YStack gap="$4">
            <TutorialsList
              tutorials={[
                {
                  title: 'Keep devices on same network',
                },
                {
                  title: 'Open OneKey on another device',
                },
                {
                  title: 'Scan the QR code',
                  description:
                    'Use the camera to scan the QR code displayed on this device',
                  children: (
                    <Button
                      size="small"
                      variant="tertiary"
                      mt="$2"
                      onPress={() => {
                        Toast.success({
                          title: 'Camera opened!',
                          message: 'This is a demo toast message.',
                        });
                      }}
                    >
                      Open Camera
                    </Button>
                  ),
                },
              ]}
            />
          </YStack>
        ),
      },
      {
        title: 'Tutorial List with Titles Only',
        description: 'Minimal tutorial list without descriptions',
        element: (
          <YStack gap="$4">
            <TutorialsList
              tutorials={[
                { title: 'Download the app' },
                { title: 'Create account' },
                { title: 'Verify identity' },
                { title: 'Start trading' },
              ]}
            />
          </YStack>
        ),
      },
      {
        title: 'Using OrderedList Alias',
        description: 'Same component imported as OrderedList',
        element: (
          <YStack gap="$4">
            <OrderedList
              tutorials={[
                { title: 'Initialize project' },
                { title: 'Install dependencies' },
                { title: 'Configure settings' },
                { title: 'Run application' },
              ]}
            />
          </YStack>
        ),
      },
    ]}
  />
);

export default TutorialsListGallery;
