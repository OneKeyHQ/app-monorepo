import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.505 12 12 22.227v-5.718c-3.59.057-5.51.427-6.678 1.01-1.18.59-1.682 1.437-2.427 2.928L1 20c0-4.284.615-7.507 2.581-9.62C5.409 8.419 8.201 7.629 12 7.517V1.773zM14 9.5h-1c-4.187 0-6.566.751-7.956 2.244-.973 1.045-1.577 2.574-1.857 4.809a6 6 0 0 1 1.24-.823c1.73-.864 4.315-1.23 8.573-1.23h1v3.273L20.495 12 14 6.226z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgForward;
