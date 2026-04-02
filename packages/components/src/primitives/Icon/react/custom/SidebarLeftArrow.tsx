import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSidebarLeftArrow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 25" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 4.33H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3m0-16h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9m0-16v16"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15.5 10.33-2 2 2 2"
    />
  </Svg>
);
export default SvgSidebarLeftArrow;
