import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4H2zm4.5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M2 13h20v4a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zm4.5 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServer;
