import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGooglePlay = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 18 20" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11.482 9.223 3.578 1.297 13.634 7.07zM1.515.83c-.466.244-.778.688-.778 1.265V17.9c0 .577.312 1.021.778 1.265l9.19-9.169zm15.228 8.08-2.11-1.221L12.28 10l2.353 2.31 2.153-1.222c.644-.512.644-1.665-.043-2.177M3.578 18.703l10.056-5.774-2.152-2.152z"
    />
  </Svg>
);
export default SvgGooglePlay;
