import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgCryptoorg = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)" fill="#8C8CA1">
      <Path d="M8.004 2 3 4.875v5.75L8.004 13.5 13 10.625v-5.75L8.004 2Zm3.514 7.772-3.522 2.021-3.514-2.021V5.728l3.522-2.021 3.514 2.021v4.044Z" />
      <Path d="M8.004 13.5 13 10.625v-5.75L8.004 2v1.707l3.514 2.021V9.78l-3.522 2.022V13.5h.008Z" />
      <Path d="M7.996 2 3 4.875v5.75L7.996 13.5v-1.707L4.482 9.772V5.72l3.514-2.013V2Z" />
      <Path d="m10.336 9.093-2.332 1.342-2.34-1.342V6.408l2.34-1.342 2.332 1.342-.975.564-1.365-.788-1.357.788v1.565l1.365.788 1.366-.788.966.556Z" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(3 2)" d="M0 0h10v11.5H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgCryptoorg;
