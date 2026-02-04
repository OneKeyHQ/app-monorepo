import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrowser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12H4v6h16zM4 6v4h16V6zm18 12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    <Path d="M6.5 8a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m3 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m3 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0M7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
  </Svg>
);
export default SvgBrowser;
