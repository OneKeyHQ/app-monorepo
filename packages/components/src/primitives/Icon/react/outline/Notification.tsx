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
      d="M12 2a8.234 8.234 0 0 1 8.187 7.356l.688 6.431A2 2 0 0 1 18.887 18H16.9a5.001 5.001 0 0 1-9.8 0H5.114a2 2 0 0 1-1.989-2.213l.689-6.43A8.235 8.235 0 0 1 12 2M9.174 18c.412 1.165 1.52 2 2.826 2a3 3 0 0 0 2.825-2zM12 4a6.234 6.234 0 0 0-6.198 5.57L5.112 16h13.775l-.69-6.43A6.233 6.233 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotification;
