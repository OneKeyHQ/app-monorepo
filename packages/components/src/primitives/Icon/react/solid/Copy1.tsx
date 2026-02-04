import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCopy1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 3.5A1.5 1.5 0 0 1 3.5 2h11A1.5 1.5 0 0 1 16 3.5V8h4.5A1.5 1.5 0 0 1 22 9.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 8 20.5V16H3.5A1.5 1.5 0 0 1 2 14.5zM14 8H9.5A1.5 1.5 0 0 0 8 9.5V14H4V4h10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCopy1;
