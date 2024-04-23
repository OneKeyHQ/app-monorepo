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
                Toast.message({
                  title: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque nec elementum eros. Vestibulum faucibus nibh id tincidunt sollicitudin. Donec elementum sollicitudin sollicitudin. Nunc eu urna nisl. Praesent justo purus, egestas nec accumsan ac, pharetra nec eros. Praesent aliquet blandit lorem, eu placerat nibh mattis in. Aliquam porta dignissim urna ac faucibus. Integer erat eros, posuere vel arcu vitae, efficitur tincidunt massa. Sed sollicitudin at nunc ut auctor. Donec sit amet risus ut tellus faucibus efficitur. Ut lobortis hendrerit ipsum non hendrerit. Donec nec bibendum dui.
                    Phasellus leo libero, mollis at mi in, pellentesque lobortis ante. Morbi nisl tellus, pulvinar non nunc vitae, pretium tincidunt lorem. Nam facilisis, ipsum rhoncus rutrum volutpat, ligula sapien pharetra velit, non mattis mauris ipsum id ante. Duis consequat, justo ornare vulputate interdum, leo turpis pretium magna, eu mattis felis est eget quam. Sed dignissim convallis lacinia. Proin efficitur elementum mauris. Nullam quis consequat libero, nec elementum sem.
                    Pellentesque tempus, neque eu sollicitudin fringilla, magna turpis ultrices nisi, vitae ornare ipsum neque in sapien. Phasellus tempus euismod sapien, quis facilisis velit pretium et. Quisque a lectus aliquam diam placerat tincidunt eget a nisi. Etiam ac quam ut erat porttitor tristique sed ut magna. Vivamus aliquam, neque non dapibus mattis, magna dui viverra sem, sed ultrices eros lorem ac massa. Vestibulum semper vestibulum nulla eu placerat. Suspendisse congue, velit a sagittis varius, purus nisi ultrices nunc, ac iaculis eros lectus et lacus.
                    Suspendisse placerat ut nisi et mollis. Sed aliquam vestibulum suscipit. Duis facilisis ipsum sed blandit tempor. Aenean posuere lacus nulla, eget luctus velit venenatis vel. Suspendisse sit amet lorem risus. Vivamus lacinia eleifend ultrices. In pharetra laoreet diam. Vestibulum eget neque eu erat dapibus dapibus. Donec efficitur non velit condimentum sodales. Maecenas auctor arcu sed libero gravida vulputate. Aenean vulputate ligula eu orci dignissim, vel egestas mi facilisis. Ut venenatis, ipsum vel ultrices ornare, risus erat dapibus turpis, quis pretium enim erat condimentum erat.
                    Etiam posuere felis nisi, eget sodales dolor aliquet id. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Curabitur vulputate ut est feugiat ullamcorper. Fusce a luctus sapien, in euismod enim. Duis porttitor eros eu nulla pharetra sollicitudin. Cras a viverra neque. Proin placerat turpis urna, ac feugiat dolor auctor eu.`,
                });
              }}
            >
              Long Title
            </Button>
          </YStack>
        ),
      },
    ]}
  />
);

export default ToastGallery;
