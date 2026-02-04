import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.331 5.79a.99.99 0 0 1 1.403 0L12 9.057l3.266-3.267a.992.992 0 1 1 1.403 1.403l-3.442 3.441a1.736 1.736 0 0 1-2.454 0L7.33 7.194a.99.99 0 0 1 0-1.404Zm0 6.943a.99.99 0 0 1 1.403 0L12 16l3.266-3.266a.992.992 0 1 1 1.403 1.403l-3.442 3.441a1.736 1.736 0 0 1-2.454 0l-3.442-3.44a.99.99 0 0 1 0-1.404Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleDown;
