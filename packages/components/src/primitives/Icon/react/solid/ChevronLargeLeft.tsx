import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.496 2.333a.98.98 0 0 1 .38 1.332L10.247 12l4.63 8.336a.979.979 0 1 1-1.71.95l-4.632-8.335a1.96 1.96 0 0 1 0-1.902l4.631-8.335a.98.98 0 0 1 1.331-.38Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeLeft;
