import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEyeOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.294 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 0 1-1.414 1.414l-3.09-3.09c-2.585 1.441-5.48 1.762-8.218.933-2.981-.904-5.692-3.144-7.614-6.607a1.94 1.94 0 0 1-.001-1.884c1.041-1.877 2.314-3.395 3.738-4.536L2.294 3.707a1 1 0 0 1 0-1.414m6.26 7.676a4 4 0 0 0 5.478 5.478l-1.513-1.514a2 2 0 0 1-2.451-2.45z"
      clipRule="evenodd"
    />
    <Path d="M12 4c4.095 0 8.066 2.439 10.628 7.055a1.95 1.95 0 0 1 0 1.89 16.2 16.2 0 0 1-2.273 3.167L8.762 4.52A10.4 10.4 0 0 1 12 4" />
  </Svg>
);
export default SvgEyeOff;
