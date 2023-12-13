import { ListItem, Page, Stack, Text } from '@onekeyhq/components';

const HardwareSdkUrl = () => (
  <Page>
    <ListItem title="onekey.so" subtitle="Default" />
    <ListItem
      title="onekeycn.so"
      subtitle="Optimized for mainland China network"
    />
    <Stack px="$5">
      <Text>
        The hardware bridge is a local server designed for communication between
        the App and hardware. Due to cross-domain issues in communication
        between Web and plugins, the hardware SDK needs to be deployed on the
        OneKey official website while hardware bridge and SDK are built in the
        desktop App. The Bridge only responds to requests from the official
        OneKey domain.
      </Text>
    </Stack>
  </Page>
);

export default HardwareSdkUrl;
