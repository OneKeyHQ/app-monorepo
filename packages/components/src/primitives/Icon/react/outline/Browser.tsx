import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrowser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0 .5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1M9 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0 .5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1m3-.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2m0 .5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16v-6H4zm0-8h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrowser;
