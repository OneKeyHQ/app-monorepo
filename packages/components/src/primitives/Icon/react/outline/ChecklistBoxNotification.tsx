import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBoxNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 17a2 2 0 1 0-4 0v2h4zM9.74 13.153a1 1 0 0 1 1.6 1.2L9.468 16.85a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 0 1 1.11-1.664l.337.225 1.304-1.739Zm0-6a1 1 0 0 1 1.6 1.2l-1.872 2.495a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 0 1 1.11-1.664l.337.225 1.304-1.739ZM19 10V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a1 1 0 1 1-2 0m-2.942-2a1 1 0 1 1 0 2h-2a1 1 0 0 1 0-2zM22 20a1 1 0 0 1-1 1h-1.27a1.998 1.998 0 0 1-3.46 0H15a1 1 0 0 1-1-1v-3a4 4 0 0 1 8 0z" />
  </Svg>
);
export default SvgChecklistBoxNotification;
