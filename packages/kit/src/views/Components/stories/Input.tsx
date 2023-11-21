import { Input, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const InputGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Sizes',
        element: (
          <Stack space="$4">
            <Input size="small" placeholder="Placeholder" />
            <Input size="medium" placeholder="Placeholder" />
            <Input size="large" placeholder="Placeholder" />
          </Stack>
        ),
      },
      {
        title: 'Input with icon',
        element: (
          <Stack space="$4">
            <Input
              size="small"
              placeholder="Placeholder"
              leftIconName="SearchOutline"
            />
            <Input
              size="medium"
              placeholder="Placeholder"
              leftIconName="SearchOutline"
            />
            <Input
              size="large"
              placeholder="Placeholder"
              leftIconName="SearchOutline"
            />
          </Stack>
        ),
      },
      {
        title: 'Input with actions',
        element: (
          <Stack space="$4">
            <Input
              size="small"
              placeholder="Placeholder"
              addOns={[
                {
                  iconName: 'EyeOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
                {
                  iconName: 'TouchIdOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="medium"
              placeholder="Placeholder"
              addOns={[
                {
                  iconName: 'EyeOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
                {
                  iconName: 'TouchIdOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="large"
              disabled
              placeholder="Placeholder"
              addOns={[
                {
                  iconName: 'EyeOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                  loading: true,
                },
              ]}
            />
            <Input
              size="large"
              readonly
              placeholder="Placeholder"
              addOns={[
                {
                  iconName: 'EyeOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                  loading: true,
                },
              ]}
            />
            <Input
              size="large"
              placeholder="Placeholder"
              addOns={[
                {
                  iconName: 'EyeOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
                {
                  iconName: 'ArrowRightOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="small"
              placeholder="Placeholder"
              addOns={[
                {
                  label: 'Paste',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="medium"
              placeholder="Placeholder"
              addOns={[
                {
                  label: 'Paste',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="large"
              placeholder="Placeholder"
              addOns={[
                {
                  label: 'Paste',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
          </Stack>
        ),
      },
      {
        title: 'States',
        element: (
          <Stack space="$4">
            <Input
              size="medium"
              value="Disabled"
              disabled
              placeholder="Placeholder"
              leftIconName="SearchOutline"
              addOns={[
                {
                  iconName: 'XCircleOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="medium"
              value="Readonly"
              editable={false}
              placeholder="Placeholder"
              leftIconName="SearchOutline"
              addOns={[
                {
                  iconName: 'XCircleOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
            <Input
              size="medium"
              value="Error"
              error
              placeholder="Placeholder"
              leftIconName="SearchOutline"
              addOns={[
                {
                  iconName: 'XCircleOutline',
                  onPress: () => {
                    console.log('clicked');
                  },
                },
              ]}
            />
          </Stack>
        ),
      },
    ]}
  />
);

export default InputGallery;
