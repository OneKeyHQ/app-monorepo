import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgEthereum = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m12 6.5.809-.588a1 1 0 0 0-1.618 0L12 6.5ZM8 12l-.809-.588a1 1 0 0 0 0 1.176L8 12Zm4 5.5-.809.588a1 1 0 0 0 1.618 0L12 17.5Zm4-5.5.809.588a1 1 0 0 0 0-1.176L16 12Zm-4 1-.242.97c.159.04.325.04.485 0L12 13Zm-.809-7.088-4 5.5 1.618 1.176 4-5.5-1.618-1.176Zm-4 6.676 4 5.5 1.618-1.176-4-5.5-1.618 1.176Zm5.618 5.5 4-5.5-1.618-1.176-4 5.5 1.618 1.176Zm4-6.676-4-5.5-1.618 1.176 4 5.5 1.618-1.176ZM7.757 12.97l4 1 .486-1.94-4-1-.486 1.94Zm4.486 1 4-1-.485-1.94-4 1 .485 1.94ZM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10h-2Zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10v-2Zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12h2Zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10v2Z"
    />
  </Svg>
);
export default SvgEthereum;
