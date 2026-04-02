import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationBadge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.78 3A6.017 6.017 0 0 0 21 11.22V21H3V3z" />
    <Path
      fillRule="evenodd"
      d="M15.172 3.172a4 4 0 1 1 5.656 5.655 4 4 0 0 1-5.656-5.655m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationBadge;
