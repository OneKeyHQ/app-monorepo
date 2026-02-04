import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthereum = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-8-6.5a1 1 0 0 1 .809.412l4 5.5a1 1 0 0 1 0 1.176l-4 5.5a1 1 0 0 1-1.618 0l-4-5.5a1 1 0 0 1 0-1.176l4-5.5.076-.092A1 1 0 0 1 12 5.5m.242 8.47a1 1 0 0 1-.484 0l-1.332-.333L12 15.8l1.573-2.163zM9.68 11.39l2.32.58 2.32-.58L12 8.2zM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgEthereum;
