import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationBadge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.78 3A6.017 6.017 0 0 0 21 11.22V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <Path
      fillRule="evenodd"
      d="M19.414 4.586a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828m1.414-1.414a4 4 0 1 0-5.656 5.656 4 4 0 0 0 5.656-5.656"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationBadge;
