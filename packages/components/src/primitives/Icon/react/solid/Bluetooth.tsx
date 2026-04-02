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
      d="M18.571 8.008 13.691 12l4.88 3.993-8.57 7.143v-8.117l-4.14 3.388-1.267-1.548L10 12.435v-.87L4.594 7.14 5.86 5.593l4.141 3.387V.865zm-6.57 5.375v5.482l3.43-2.857-3.319-2.716-.111.09Zm0-2.766.111.09 3.319-2.714L12 5.136v5.48Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBluetooth;
