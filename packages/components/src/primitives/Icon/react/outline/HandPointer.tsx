import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandPointer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 2a3 3 0 0 1 3 3v3h4a4 4 0 0 1 4 4v1.83a8.171 8.171 0 0 1-15.401 3.805L2.31 11.387l.408-.512.75-.938A3 3 0 0 1 7 9.06V5a3 3 0 0 1 3-3m0 2a1 1 0 0 0-1 1v8.081l-2.563-2.05a1 1 0 0 0-1.406.155l-.342.427 2.68 5.09A6.171 6.171 0 0 0 19 13.83V12a2 2 0 0 0-2-2h-6V5a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHandPointer;
