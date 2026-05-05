import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBoxSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 14.172a4 4 0 0 1 6.274 4.86L22.414 21 21 22.414l-1.968-1.968a4.001 4.001 0 0 1-4.86-6.274m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
    <Path d="M21 11h-2V5H5v14h6v2H3V3h18z" />
    <Path d="M11.94 13.554 8.9 17.605l-2.744-1.829 1.11-1.664 1.169.78 1.905-2.538zm0-6.002L8.9 11.605l-2.744-1.83 1.11-1.664 1.169.78 1.905-2.538zM17.058 10h-4V8h4z" />
  </Svg>
);
export default SvgChecklistBoxSearch;
