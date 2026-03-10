import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m10.535 3 2 3H21v4h2.111l-3.126 10H2V3zM4 18h.765l2.5-8H19V8h-7.535l-2-3H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderOpen;
