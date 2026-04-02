import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a8.233 8.233 0 0 1 8.186 7.356L21.113 18H16.9a5.001 5.001 0 0 1-9.798 0H2.887l.926-8.644A8.233 8.233 0 0 1 12 2M9.174 18c.412 1.165 1.52 2 2.826 2a3 3 0 0 0 2.826-2zM12 4a6.234 6.234 0 0 0-6.198 5.57L5.112 16h13.776l-.69-6.43A6.234 6.234 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotification;
