import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeystone = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.5 3.75h9l-6 12.75H3zM19.5 20.25h-9l6-12.75H21z"
    />
  </Svg>
);
export default SvgKeystone;
