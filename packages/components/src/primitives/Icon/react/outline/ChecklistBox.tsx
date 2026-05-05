import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.94 13.554 8.9 17.605l-2.744-1.829 1.11-1.664 1.169.78 1.905-2.538zM17 16h-4v-2h4zm-5.06-8.448L8.9 11.605l-2.744-1.83 1.11-1.664 1.169.78 1.905-2.538zM17.058 10h-4V8h4z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklistBox;
