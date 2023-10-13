import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBase = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.015 8c0 3.313-2.69 5.998-6.01 5.998s-5.734-2.417-5.99-5.494H9.96v-1.01H2.015a6.005 6.005 0 0 1 5.99-5.493c3.32 0 6.01 2.686 6.01 5.999Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgBase;
