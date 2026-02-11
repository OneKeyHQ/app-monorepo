import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.5 14.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m0-7a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M20 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 18h16v-5H4zm0-7h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServer;
