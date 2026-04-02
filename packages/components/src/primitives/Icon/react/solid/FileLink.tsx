import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 18a2 2 0 1 0 4 0v-1h2v1a4 4 0 0 1-8 0v-1h2z" />
    <Path d="M12 10h8v12h-9.527A5.98 5.98 0 0 0 12 18v-3a6 6 0 0 0-8-5.658V2h8z" />
    <Path d="M7 15v3H5v-3z" />
    <Path d="M6 11a4 4 0 0 1 4 4v1H8v-1a2 2 0 1 0-4 0v1H2v-1a4 4 0 0 1 4-4m13.414-3H14V2.586z" />
  </Svg>
);
export default SvgFileLink;
