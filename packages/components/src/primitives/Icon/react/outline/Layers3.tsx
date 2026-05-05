import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayers3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.238 16-10.236 5.118L1.766 16l2.236-1.118 8 4 8-4z" />
    <Path d="m22.238 12-10.236 5.118L1.766 12l2.236-1.118 8 4 8-4z" />
    <Path
      fillRule="evenodd"
      d="m22.237 8-10.235 5.118L1.766 8l10.236-5.118zm-16 0 5.765 2.882L17.766 8l-5.764-2.882z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayers3;
