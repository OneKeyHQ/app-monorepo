import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulkSendOneToMany = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 6a2.998 2.998 0 0 0-5.825-1H11v6H8.826a2.998 2.998 0 1 0-1.311 3.583A3 3 0 0 0 8.826 13H11v6h4.175A2.998 2.998 0 0 0 21 18a2.998 2.998 0 0 0-5.825-1H13V7h2.175A2.998 2.998 0 0 0 21 6M7 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0m12 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0m0-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBulkSendOneToMany;
