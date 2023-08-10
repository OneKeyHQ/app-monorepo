import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgCelo = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)" fill="#8C8CA1">
      <Path d="M6.947 11.948a2.895 2.895 0 1 0 0-5.79 2.895 2.895 0 0 0 0 5.79Zm0 1.052a3.947 3.947 0 1 1 0-7.895 3.947 3.947 0 0 1 0 7.895Z" />
      <Path d="M9.053 9.842a2.895 2.895 0 1 0 0-5.79 2.895 2.895 0 0 0 0 5.79Zm0 1.053a3.947 3.947 0 1 1 0-7.895 3.947 3.947 0 0 1 0 7.895Z" />
      <Path d="M9.183 10.895c.274-.332.47-.72.574-1.138.418-.104.806-.3 1.138-.574-.015.483-.12.96-.307 1.405a3.932 3.932 0 0 1-1.405.307Zm-2.94-4.652c-.417.104-.806.3-1.138.574.016-.483.12-.96.307-1.405a3.933 3.933 0 0 1 1.405-.307c-.274.332-.47.72-.574 1.138Z" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(3 3)" d="M0 0h10v10H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgCelo;
