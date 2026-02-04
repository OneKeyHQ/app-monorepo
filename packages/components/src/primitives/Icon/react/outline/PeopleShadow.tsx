import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleShadow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.036 12.177c3.625-.881 7.488 1.542 8.324 6.595.206 1.245-.804 2.229-1.935 2.229h-3.927a1 1 0 0 1 0-2h3.871c-.708-4.03-3.572-5.437-5.86-4.88a1 1 0 0 1-.473-1.944" />
    <Path
      fillRule="evenodd"
      d="M7.502 11.999c3.178 0 6.14 2.414 6.861 6.767.206 1.24-.799 2.233-1.934 2.233H2.574c-1.135 0-2.14-.993-1.934-2.233l.074-.403C1.547 14.264 4.423 12 7.502 12Zm0 2c-2.023 0-4.259 1.513-4.872 5h9.743c-.613-3.487-2.848-5-4.871-5m-.002-11a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4m9-2a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleShadow;
