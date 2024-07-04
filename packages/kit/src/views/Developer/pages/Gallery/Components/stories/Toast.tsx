/* eslint-disable spellcheck/spell-checker */
import { Button, Toast, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function generateLongTestText(num: number) {
  return new Array(num)
    .fill(
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
       Quisque nec elementum eros. 
       Vestibulum faucibus nibh id tincidunt sollicitudin. 
       Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
       Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
       Vestibulum faucibus nibh id tincidunt sollicitudin. 
       Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
       Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.`,
    )
    .join('');
}

const LONG_DURATION = 999999;

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Native',
        element: (
          <YStack space="$2" justifyContent="center">
            <Button
              onPress={() => {
                Toast.success({
                  title: 'Account created',
                });
              }}
            >
              Success
            </Button>
            <Button
              onPress={() => {
                Toast.error({
                  title: 'Create account failed',
                });
              }}
            >
              Error
            </Button>
            <Button
              onPress={() => {
                Toast.message({
                  title: 'Address copied',
                });
              }}
            >
              Default
            </Button>
            <Button
              onPress={() => {
                Toast.success({
                  title: '',
                  message: 'title is empty string',
                });
              }}
            >
              title is empty string
            </Button>
            <Button
              onPress={() => {
                Toast.success({
                  title: generateLongTestText(1),
                });
              }}
            >
              Long Title
            </Button>
            <Button
              onPress={() => {
                Toast.success({
                  duration: LONG_DURATION,
                  title: generateLongTestText(10),
                });
              }}
            >
              Long Title
            </Button>
            <Button
              onPress={() => {
                Toast.error({
                  duration: LONG_DURATION,
                  title: 'Title',
                  message: generateLongTestText(10),
                });
              }}
            >
              Long message
            </Button>

            <Button
              onPress={() => {
                Toast.error({
                  duration: LONG_DURATION,
                  title:
                    'Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet',
                  message: generateLongTestText(10),
                });
              }}
            >
              Long Title with Long message
            </Button>
            <Button
              onPress={() => {
                Toast.error({
                  duration: LONG_DURATION,
                  title: 'Title',
                  message: `Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet`,
                  actionsProps: {
                    children: 'Copy',
                    my: '$2',
                    onPress: () => {
                      alert('Copy it');
                    },
                  },
                });
              }}
            >
              Copy it
            </Button>

            <Button
              onPress={() => {
                Toast.error({
                  duration: LONG_DURATION,
                  title: 'Title',
                  message: `Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet`,
                  actions: [
                    <Button
                      variant="primary"
                      size="small"
                      key="primary"
                      onPress={() => {
                        alert('Primary');
                      }}
                    >
                      Primary
                    </Button>,
                    <Button
                      variant="secondary"
                      size="small"
                      key="secondary"
                      onPress={() => {
                        alert('Secondary');
                      }}
                    >
                      Secondary
                    </Button>,
                  ],
                });
              }}
            >
              Actions
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
