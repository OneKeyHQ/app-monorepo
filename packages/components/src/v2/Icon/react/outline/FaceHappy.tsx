import Svg, { Circle, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceHappy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} />
    <Path
      fill="currentColor"
      d="M9.351 12.13c1.898-1.507 2.176-2.95 1.613-3.83a1.524 1.524 0 0 0-1.225-.707 1.561 1.561 0 0 0-1.218.53 1.561 1.561 0 0 0-1.326-.082c-.456.186-.8.588-.91 1.083-.227 1.02.527 2.282 2.826 3.048a.256.256 0 0 0 .24-.043Zm5.539.042c2.298-.766 3.052-2.027 2.825-3.048a1.524 1.524 0 0 0-.91-1.082 1.561 1.561 0 0 0-1.326.081 1.562 1.562 0 0 0-1.217-.53 1.525 1.525 0 0 0-1.226.706c-.563.881-.285 2.325 1.613 3.83.068.054.158.07.24.043ZM11.999 18a4 4 0 0 0 3.962-3.447c.04-.294-.219-.526-.514-.5a38.552 38.552 0 0 1-6.896 0c-.296-.026-.555.206-.514.5A4 4 0 0 0 11.999 18Z"
    />
  </Svg>
);
export default SvgFaceHappy;
