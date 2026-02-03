import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPower = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.276 1.486a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1M8.132 4.432a1 1 0 0 1-.28 1.386 8 8 0 1 0 8.846 0 1 1 0 0 1 1.108-1.665 9.99 9.99 0 0 1 4.47 8.333c0 5.522-4.477 10-10 10s-10-4.478-10-10a9.99 9.99 0 0 1 4.47-8.333 1 1 0 0 1 1.386.279"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPower;
