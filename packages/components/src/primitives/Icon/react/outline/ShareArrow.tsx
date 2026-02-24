import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareArrow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.505 12 12 1.773v5.718c-3.59-.057-5.51-.427-6.678-1.01-1.18-.59-1.682-1.437-2.427-2.928L1 4c0 4.284.615 7.507 2.581 9.62 1.828 1.963 4.62 2.752 8.419 2.864v5.743zM14 14.5h-1c-4.187 0-6.566-.751-7.956-2.244-.973-1.045-1.577-2.574-1.857-4.809a6 6 0 0 0 1.24.823C6.157 9.133 8.742 9.5 13 9.5h1V6.227L20.495 12 14 17.774z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShareArrow;
