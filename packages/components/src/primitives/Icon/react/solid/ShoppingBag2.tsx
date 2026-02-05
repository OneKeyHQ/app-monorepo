import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShoppingBag2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8.08 6.12a3.92 3.92 0 0 1 7.84 0v.98h.63c.967 0 1.79.705 1.938 1.662l1.658 10.781a1.96 1.96 0 0 1-1.937 2.259H5.79a1.96 1.96 0 0 1-1.937-2.259l1.66-10.781A1.96 1.96 0 0 1 7.45 7.098h.63v-.98Zm1.96.98h3.92v-.98a1.96 1.96 0 0 0-3.92 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShoppingBag2;
