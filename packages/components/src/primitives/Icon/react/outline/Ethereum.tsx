import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthereum = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m12 6.5.809-.588a1 1 0 0 0-1.618 0zM8 12l-.809-.588a1 1 0 0 0 0 1.176zm4 5.5-.809.588a1 1 0 0 0 1.618 0zm4-5.5.809.588a1 1 0 0 0 0-1.176zm-4 1-.242.97c.159.04.325.04.485 0zm-.809-7.088-4 5.5 1.618 1.176 4-5.5zm-4 6.676 4 5.5 1.618-1.176-4-5.5zm5.618 5.5 4-5.5-1.618-1.176-4 5.5zm4-6.676-4-5.5-1.618 1.176 4 5.5zM7.757 12.97l4 1 .486-1.94-4-1zm4.486 1 4-1-.485-1.94-4 1zM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10z"
    />
  </Svg>
);
export default SvgEthereum;
