/* eslint-disable spellcheck/spell-checker */
import { Button, Toast, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

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
                  duration: 999999,
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
                  duration: 999999,
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
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
