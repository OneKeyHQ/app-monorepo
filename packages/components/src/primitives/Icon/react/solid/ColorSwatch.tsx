import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 4.145c0-1.085.88-1.964 1.964-1.964h6.873c.644 0 1.216.31 1.574.79a1 1 0 0 1 .389.126l4.694 2.71c.558.322.898.876.968 1.47a1 1 0 0 1 .274.305l2.71 4.694c.543.94.22 2.14-.718 2.682l-9.4 5.427C10.107 21.09 8.89 21.82 7.4 21.82a5.4 5.4 0 0 1-5.4-5.4zM13.316 16.97l6.43-3.712-2.143-3.712zm-.515-3.034 3.71-6.428-3.71-2.143zm-6.874 2.482a1.473 1.473 0 1 1 2.946 0 1.473 1.473 0 0 1-2.946 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
