import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthereum = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12 15.8-1.572-2.162L12 14.03l1.572-.393zm2.32-4.41-2.32.579-2.32-.58L12 8.2z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M6.764 12 12 19.2l5.236-7.2L12 4.8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEthereum;
