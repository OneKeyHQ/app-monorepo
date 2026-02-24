import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12.4 8 1 2.6 2.6 1v.8l-2.6 1-1 2.6h-.8l-1-2.6-2.6-1v-.8l2.6-1 1-2.6z" />
    <Path
      fillRule="evenodd"
      d="M12 4c4.24 0 8.34 2.61 10.889 7.54l.237.46-.237.459C20.339 17.389 16.239 20 12 20c-4.24 0-8.34-2.61-10.889-7.54L.874 12l.237-.459C3.661 6.611 7.761 4 12 4m0 2c-3.228 0-6.586 1.913-8.864 6 2.278 4.087 5.636 6 8.864 6s6.585-1.913 8.863-6C18.585 7.913 15.228 6 12 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicEye;
