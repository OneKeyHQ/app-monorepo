import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckRadio = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.407 9.36-5.833 7.128L7.086 13 8.5 11.586l1.925 1.925 4.434-5.418z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckRadio;
