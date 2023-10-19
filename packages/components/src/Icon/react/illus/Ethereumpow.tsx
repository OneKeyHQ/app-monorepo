import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgEthereumpow = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)" fill="#8C8CA1">
      <Path d="M4.371 8.043 8 2v4.516L4.371 8.043ZM11.629 8.043 8 2v4.516l3.629 1.527Z" />
      <Path d="M8 6.502 4.371 8.033 8 10.15V6.502ZM8 6.502l3.629 1.531L8 10.15V6.502ZM4.371 8.739 8 13.999V10.86L4.371 8.74ZM11.629 8.739 8 13.999V10.86l3.629-2.121Z" />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.503 5.36c0 .233-.18.425-.409.444l.145 2.652h.005c.091 0 .177.027.247.075l1.23-1.66a.446.446 0 1 1 .523.032l1.197 1.614a.444.444 0 0 1 .225-.061h.004l.145-2.654a.446.446 0 1 1 .043.003l-.145 2.653a.446.446 0 1 1-.308.082L8.207 6.924a.445.445 0 0 1-.45-.027l-1.23 1.66a.445.445 0 1 1-.331-.099l-.145-2.652a.446.446 0 1 1 .452-.447Z"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(4.371 2)" d="M0 0h7.258v12H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgEthereumpow;
