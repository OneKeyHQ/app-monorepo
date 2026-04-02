import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrossedSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.87 8.25 14.12 12l3.75 3.75-2.12 2.121-3.75-3.75-3.75 3.75-2.121-2.121L9.879 12l-3.75-3.75 2.12-2.121L12 9.879l3.75-3.75 2.122 2.121Z" />
  </Svg>
);
export default SvgCrossedSmall;
