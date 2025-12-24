/* eslint-disable spellcheck/spell-checker */
import { Button, Toast, ToastContent, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ONE_HOUR = 60 * 60 * 1000;

const ToastGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Toast"
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
                Toast.loading({
                  duration: ONE_HOUR,
                  title: 'Processing transaction',
                });
              }}
            >
              All Types
            </Button>
            <Button
              onPress={() => {
                Toast.success({
                  title: 'url!',
                  message:
                    'look, <url>https://onekey.so<underline>here</underline></url>. OneKey.',
                });
              }}
            >
              Toast with url
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
                Toast.loading({
                  duration: ONE_HOUR,
                  title: 'Processing transaction...',
                  message: 'Please wait while we process your transaction',
                });
              }}
            >
              Loading Toast
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
                    'You can only transfer funds to accounts within the wallet or to allowlisted addresses in the address book. If you understand the risks, you can enable it in <url>https://app.onekey.so/send/protection<underline>Settings >> Protection</underline></url>',
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
            <Button
              onPress={() => {
                const toast = Toast.warning({
                  onClose: () => {
                    console.log('onClose');
                  },
                  duration: ONE_HOUR,
                  title: 'OneKey Bridge test',
                  actions: (
                    <Button
                      variant="primary"
                      size="small"
                      onPress={() => {
                        toast?.close();
                      }}
                    >
                      close it
                    </Button>
                  ),
                });
              }}
            >
              Toast with close button
            </Button>
            <Button
              onPress={() => {
                Toast.loading({
                  duration: 3000,
                  title: 'Loading...',
                  message: 'Please wait',
                });
              }}
            >
              Simple Loading Toast
            </Button>
            <Button
              onPress={() => {
                const loadingToast = Toast.loading({
                  duration: ONE_HOUR,
                  title: 'Processing transaction',
                  message: 'This may take a few seconds...',
                  actions: (
                    <Button
                      variant="secondary"
                      size="small"
                      onPress={() => {
                        loadingToast?.close();
                      }}
                    >
                      Cancel
                    </Button>
                  ),
                });

                // Simulate async operation
                setTimeout(() => {
                  loadingToast?.close();
                  Toast.success({
                    title: 'Transaction completed',
                    message: 'Your transaction has been processed successfully',
                  });
                }, 5000);
              }}
            >
              Loading with Auto Complete
            </Button>
            <Button
              onPress={() => {
                Toast.notification({
                  title:
                    'TRON Energy Rental Service Now Live - Instant & Affordable Energy',
                  message:
                    'Rent TRON energy instantly for TRC20 transfers and smart contracts. Save up to 70% vs staking.',
                  icon: 'SpeakerPromoteOutline',
                  imageUri: 'https://uni.onekey-asset.com/static/chain/btc.png',
                });
              }}
            >
              toast notification
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
