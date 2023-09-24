import { View } from 'react-native';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

export const decorators = [
  /* by wrapping everything in a view the parent container is always using flexbox and behaves like a react-native-web component would  */
  (Story) => (
    <View>
      <Story />
    </View>
  ),
];
