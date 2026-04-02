import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicHands = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.757 11.528a3.25 3.25 0 0 1 4.071 1.71l1.418-.515.684 1.879a4 4 0 0 1-7.517 2.736l-.599-1.645a3.25 3.25 0 0 1 1.943-4.165m12.416 1.71a3.25 3.25 0 0 1 6.014 2.455l-.6 1.645a4 4 0 0 1-7.517-2.736l.685-1.88zM12 6a6 6 0 0 1 5.572 3.77l-1.856.745a4.003 4.003 0 0 0-7.43 0L6.428 9.77A6 6 0 0 1 12 6" />
    <Path d="M12 3a9 9 0 0 1 8.358 5.656l-1.856.743a7.003 7.003 0 0 0-13.003 0l-1.856-.743A9 9 0 0 1 12 3" />
  </Svg>
);
export default SvgMagicHands;
