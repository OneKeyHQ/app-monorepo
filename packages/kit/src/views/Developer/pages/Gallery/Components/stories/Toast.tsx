/* eslint-disable spellcheck/spell-checker */
import { Button, Toast, ToastContent, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ONE_HOUR = 60 * 60 * 1000;

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Native',
        element: (
          <YStack gap="$2" justifyContent="center">
            <Button
              onPress={() => {
                Toast.message({
                  duration: ONE_HOUR,
                  title: 'Account created',
                });
                Toast.error({
                  duration: ONE_HOUR,
                  title: 'Create account failed',
                });
                Toast.warning({
                  duration: ONE_HOUR,
                  title: 'Create account failed',
                });
                Toast.success({
                  duration: ONE_HOUR,
                  title: 'Address copied',
                });
              }}
            >
              All Types
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
                  title: `Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, Hello World, 444444444444444444444444`,
                });
              }}
            >
              Long Title
            </Button>
            <Button
              onPress={() => {
                Toast.success({
                  duration: ONE_HOUR,
                  title: `Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. `,
                });
              }}
            >
              Long Title
            </Button>
            <Button
              onPress={() => {
                Toast.error({
                  duration: ONE_HOUR,
                  title: 'Title',
                  message: `Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.`,
                });
              }}
            >
              Long message
            </Button>

            <Button
              onPress={() => {
                Toast.error({
                  duration: ONE_HOUR,
                  title:
                    'Lorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit ametLorem ipsum dolor sit amet',
                  message: `Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.Lorem ipsum dolor sit amet, 
                    consectetur adipiscing elit. 
                    Quisque nec elementum eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. 
                    Vestibulum faucibus nibh id tincidunt sollicitudin. 
                    Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl.
                    Praesent justo purus, egestas nec accumsan ac, pharetra nec eros.`,
                });
              }}
            >
              Long Title with Long message
            </Button>
            <Button
              onPress={() => {
                new Array(10).fill(0).forEach(() => {
                  setTimeout(() => {
                    Toast.error({
                      toastId: '403',
                      title: '403!',
                      message: `ERROR 403!`,
                    });
                  }, 0);
                });
              }}
            >
              filter out duplicate toasts by toastId
            </Button>
            <Button
              onPress={() => {
                Toast.error({
                  duration: ONE_HOUR,
                  title:
                    'Suunto’s new headphones finally made me appreciate bone conduction',
                  message: `Usually, I’m all about the bass for workout headphones, so I was surprised by how much I enjoyed the Suunto Sonic and Wing.`,
                  actions: (
                    <Button
                      variant="primary"
                      size="small"
                      onPress={() => {
                        alert('Copy it');
                      }}
                    >
                      Copy it
                    </Button>
                  ),
                });
              }}
            >
              Actions 1 (copy)
            </Button>
            <Button
              onPress={() => {
                Toast.message({
                  duration: ONE_HOUR,
                  title:
                    'A few weeks with the Daylight DC-1 tablet: rethinking screen time',
                  message: `So far, this thing doesn’t seem like a very impressive tablet. But Daylight is more a display company than a tablet company — and the display is pretty great.`,
                  actions: [
                    <Button key="1" variant="primary" size="small">
                      Primary
                    </Button>,
                  ],
                });
              }}
            >
              Actions 2 (info)
            </Button>
            <Button
              onPress={() => {
                Toast.warning({
                  duration: ONE_HOUR,
                  title:
                    'Google is trying to steal the Ray-Ban partnership from Meta',
                  message: `The smart glasses market is heating up. Also: layoffs and a strategy shift hit Magic Leap.`,
                  actions: [
                    <Button key="1" variant="secondary" size="small">
                      Secondary
                    </Button>,
                    <Button key="2" variant="primary" size="small">
                      Primary
                    </Button>,
                  ],
                });
              }}
            >
              Actions 3 (warning)
            </Button>
            <Button
              onPress={() => {
                Toast.warning({
                  duration: ONE_HOUR,
                  title:
                    'OneKey Bridge facilitates seamless communication between OneKey and your browser for a better experience.\n\nIf you encounter issues during the installation of OneKey Bridge, please refer to the <url href="https://1key.so">online tutorial</url> for assistance.',
                });
              }}
            >
              Rich Text
            </Button>
            <Button
              onPress={() => {
                Toast.show({
                  children: (
                    <YStack p="$4">
                      <ToastContent
                        title="Google is trying to steal the Ray-Ban partnership from Meta"
                        message="The smart glasses market is heating up. Also: layoffs and a strategy shift hit Magic Leap."
                        actionsAlign="left"
                        actions={[
                          <Button
                            key="1"
                            variant="secondary"
                            size="small"
                            onPressIn={() => {
                              console.log('Secondary');
                            }}
                          >
                            Secondary
                          </Button>,
                          <Button
                            key="2"
                            variant="primary"
                            size="small"
                            onPressIn={() => {
                              console.log('Primary');
                            }}
                          >
                            Primary
                          </Button>,
                        ]}
                      />
                    </YStack>
                  ),
                });
              }}
            >
              Custom
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
