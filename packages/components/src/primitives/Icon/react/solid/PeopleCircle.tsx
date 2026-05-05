import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 13c-2.395 0-4.383 1.006-5.715 2.6A7.98 7.98 0 0 0 12 20a7.98 7.98 0 0 0 5.715-2.4C16.383 16.005 14.395 15 12 15m0-8.25a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCircle;
