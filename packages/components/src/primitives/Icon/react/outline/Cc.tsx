import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.629 9.879a3 3 0 0 1 4.242 0l-1.414 1.414a1 1 0 1 0 0 1.414l1.414 1.414A3 3 0 1 1 7.63 9.88Zm5.5 0a3 3 0 0 1 4.242 0l-1.414 1.414a1 1 0 1 0 0 1.414l1.414 1.414A3 3 0 1 1 13.13 9.88Z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCc;
