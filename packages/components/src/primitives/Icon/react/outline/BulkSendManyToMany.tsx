import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulkSendManyToMany = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 15a3 3 0 1 1-2.826 4H8.826A2.998 2.998 0 0 1 3 18a3 3 0 0 1 5.826-1h6.348c.412-1.165 1.52-2 2.826-2M6 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2m12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2M18 3a3 3 0 1 1-2.826 4H8.826A2.999 2.999 0 0 1 3 6a3 3 0 0 1 5.826-1h6.348c.412-1.165 1.52-2 2.826-2M6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBulkSendManyToMany;
