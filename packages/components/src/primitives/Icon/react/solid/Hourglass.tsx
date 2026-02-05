import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHourglass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 4H4a1 1 0 0 1 0-2h16a1 1 0 1 1 0 2h-1v3.465a2 2 0 0 1-.89 1.664L13.802 12l4.306 2.871A2 2 0 0 1 19 16.535V20h1a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h1v-3.465a2 2 0 0 1 .89-1.664L10.198 12 5.891 9.129A2 2 0 0 1 5 7.465zm2 0v3h10V4zm10 14v-1.465l-5-3.333-5 3.333V18z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHourglass;
