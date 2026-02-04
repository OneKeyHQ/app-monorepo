import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.98 18.99V6.345L5.678 8.648a1.005 1.005 0 1 1-1.42-1.42l4.018-4.02.077-.068c.394-.322.976-.3 1.344.068l4.02 4.02a1.005 1.005 0 1 1-1.422 1.42L9.99 6.344V18.99h9.043a1.005 1.005 0 0 1 0 2.01H9.99c-1.11 0-2.01-.9-2.01-2.01" />
  </Svg>
);
export default SvgCornerLeftUp;
