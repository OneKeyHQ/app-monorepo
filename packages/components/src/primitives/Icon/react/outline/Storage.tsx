import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStorage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 4h10V2H7zm11 1v14h2V5zm-1 15H7v2h10zM6 19V5H4v14zm1-3h10v-2H7zm-3 1v1h2v-1zm14 0v1h2v-1zm-1-1a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zM7 14a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm0 6a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.5}
      d="M15.25 18a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm-3 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"
    />
  </Svg>
);
export default SvgStorage;
