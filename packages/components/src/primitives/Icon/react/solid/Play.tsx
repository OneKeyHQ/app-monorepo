import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlay = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.128 2.375c-1.325-.808-3.024.146-3.024 1.699v15.853c0 1.552 1.699 2.506 3.024 1.698L21.136 13.7c1.272-.775 1.272-2.622 0-3.398z" />
  </Svg>
);
export default SvgPlay;
