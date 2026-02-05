import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandPointer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 5a1 1 0 0 0-2 0v6a1 1 0 0 1-1.625.781l-.937-.75a1 1 0 0 0-1.407.156l-.341.426 2.678 5.09A6.172 6.172 0 0 0 19 13.83V12a2 2 0 0 0-2-2h-5a1 1 0 0 1-1-1zm2 3h4a4 4 0 0 1 4 4v1.83a8.171 8.171 0 0 1-15.4 3.804l-2.984-5.67a1 1 0 0 1 .104-1.09l.75-.937A3 3 0 0 1 7 9.058V5a3 3 0 0 1 6 0z" />
  </Svg>
);
export default SvgHandPointer;
