import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnchor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.5 5.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0A3.5 3.5 0 0 1 13 8.854V19.98A7.5 7.5 0 0 0 19.981 13H18a1 1 0 1 1 0-2h3a1 1 0 0 1 1 1v.5a9.5 9.5 0 0 1-9.5 9.5h-1A9.5 9.5 0 0 1 2 12.5V12a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H4.019A7.5 7.5 0 0 0 11 19.981V8.854A3.5 3.5 0 1 1 15.5 5.5" />
  </Svg>
);
export default SvgAnchor;
