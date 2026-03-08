import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBluetooth = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.57 8.007 13.69 12l4.88 3.993L10 23.135v-8.116l-4.14 3.388-1.267-1.548L10 12.435v-.87L4.593 7.14l1.266-1.548L10 8.98V.865zM12 13.382v5.482l3.429-2.857-3.319-2.715zm0-2.765.11.09 3.319-2.715L12 5.136z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBluetooth;
