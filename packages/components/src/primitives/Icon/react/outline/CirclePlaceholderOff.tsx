import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCirclePlaceholderOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.664 20.25-1.414 1.414-1.92-1.92A9.96 9.96 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.4.847-4.606 2.257-6.33L2.336 3.75 3.75 2.336zM4 12a8 8 0 0 0 12.904 6.318L5.681 7.095A7.96 7.96 0 0 0 4 12"
      clipRule="evenodd"
    />
    <Path d="M20 12A8 8 0 0 0 8.445 4.831l-.89-1.791A10 10 0 0 1 12 2c5.523 0 10 4.477 10 10a10 10 0 0 1-1.04 4.445l-1.791-.89A7.96 7.96 0 0 0 20 12" />
  </Svg>
);
export default SvgCirclePlaceholderOff;
