import { withBackgrounds } from "@storybook/addon-ondevice-backgrounds";
import { View } from "tamagui";

export const decorators = [
  withBackgrounds,
  (Story) => (
    <View padding="$4" flex={1}>
      <Story />
    </View>
  ),
];

export const parameters = {
  backgrounds: {
    default: "plain",
    values: [
      { name: "white", value: "white" },
      { name: "app", value: "#F5F6F7" },
      { name: "dark", value: "#2C2C2C" },
    ],
  },
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};
