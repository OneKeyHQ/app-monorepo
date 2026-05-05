import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleLike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.001 14.746a3.02 3.02 0 0 1 2.686.148c.946.54 1.566 1.575 1.566 2.796 0 1.653-1.142 2.816-2.024 3.48-.465.35-.924.612-1.263.786l-.965.421a11 11 0 0 1-.964-.42 9 9 0 0 1-1.263-.787c-.882-.664-2.024-1.827-2.024-3.48 0-1.222.62-2.256 1.565-2.796a3.02 3.02 0 0 1 2.686-.148" />
    <Path d="M12.001 12c1.208 0 2.325.227 3.324.638a4.7 4.7 0 0 0-2.2 1.326c-.937 1-1.376 2.314-1.376 3.678 0 1.376.55 2.503 1.194 3.358h-9.54l.102-1.094C3.917 15.521 7.243 12 12 12ZM12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" />
  </Svg>
);
export default SvgPeopleLike;
