import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBoxNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 13a4 4 0 0 1 4 4v4h-2.27a1.998 1.998 0 0 1-3.46 0H14v-4a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2v2h4v-2a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 11.803A6 6 0 0 0 12 17v4H3V3h18zm-13.564 3.09-1.17-.78-1.11 1.663 2.744 1.83 3.04-4.052-1.6-1.2zm0-6.002-1.17-.78-1.11 1.664 2.744 1.83 3.04-4.052-1.6-1.2zM13.058 10h4V8h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChecklistBoxNotification;
