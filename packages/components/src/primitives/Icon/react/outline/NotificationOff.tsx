import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 21 21 22.414l-4.16-4.16A5.002 5.002 0 0 1 7.1 18H2.888l.926-8.644c.122-1.131.47-2.19.997-3.132L1.586 3 3 1.586zm-13.24-3c.412 1.165 1.52 2 2.826 2a3 3 0 0 0 2.826-2zM6.299 7.713a6.2 6.2 0 0 0-.497 1.856L5.112 16h9.474z"
      clipRule="evenodd"
    />
    <Path d="M12 2a8.233 8.233 0 0 1 8.186 7.356l.593 5.532-1.988.213-.593-5.532a6.234 6.234 0 0 0-8.352-5.186l-.939.346-.691-1.877.938-.346A8.2 8.2 0 0 1 12 2" />
  </Svg>
);
export default SvgNotificationOff;
