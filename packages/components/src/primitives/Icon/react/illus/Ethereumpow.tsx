import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthereumpow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G fill="#8C8CA1" clipPath="url(#clip0_1208_1351)">
      <Path d="M4.371 8.043 8 2v4.516zM11.629 8.043 8 2v4.516z" />
      <Path d="M8 6.502 4.371 8.033 8 10.15zM8 6.502l3.629 1.531L8 10.15zM4.371 8.739 8 13.999V10.86zM11.629 8.739 8 13.999V10.86z" />
      <Path
        fillRule="evenodd"
        d="M6.503 5.36c0 .233-.18.425-.409.444l.145 2.652h.005c.091 0 .177.027.247.075l1.23-1.66a.446.446 0 1 1 .523.032l1.197 1.614a.44.44 0 0 1 .225-.061h.004l.145-2.654a.446.446 0 1 1 .043.003l-.145 2.653a.446.446 0 1 1-.308.082L8.207 6.924a.45.45 0 0 1-.45-.027l-1.23 1.66a.445.445 0 1 1-.331-.099l-.145-2.652a.446.446 0 1 1 .452-.447"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_1208_1351">
        <Path fill="#fff" d="M4.371 2h7.258v12H4.371z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgEthereumpow;
