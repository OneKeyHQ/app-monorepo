import { Button, Stack, Text } from '@onekeyhq/components';

import {
  ProviderJotaiContextDemo,
  useDemoComputedAtom,
  useDemoJotaiActions,
  useDemoProfileAtom,
  useDemoProfilesMapAtom,
} from '../../../states/jotai/contexts/demo';

import { Layout } from './utils/Layout';

function JotaiDemo1() {
  const [profile] = useDemoProfileAtom();
  const [map] = useDemoProfilesMapAtom();
  const [c] = useDemoComputedAtom();
  const actions = useDemoJotaiActions();
  return (
    <Stack space="$2">
      <Text>
        {profile.id}@{profile.name}
      </Text>
      <Text>{JSON.stringify(map, null, 2)}</Text>
      <Text>{c}</Text>
      <Button
        onPress={() => {
          // setA(JOTAI_RESET);
          actions.updateProfile({
            id: 15,
            name: `VV_${Date.now()}`,
          });
        }}
      >
        Update
      </Button>
      <Button
        onPress={async () => {
          const result = await actions.sayHello('=======');
          console.log('SayHi result', result);
        }}
      >
        SayHi
      </Button>
    </Stack>
  );
}

const JotaiGlobalGallery = () => (
  <ProviderJotaiContextDemo>
    <Layout
      description="jotai context"
      suggestions={['jotai']}
      boundaryConditions={['jotai']}
      elements={[
        {
          title: 'DemoAtom',
          element: (
            <Stack space="$1">
              <JotaiDemo1 />
            </Stack>
          ),
        },
      ]}
    />
  </ProviderJotaiContextDemo>
);

export default JotaiGlobalGallery;
