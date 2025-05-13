import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCelo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G fill="#8C8CA1" clipPath="url(#clip0_149_671)">
      <Path d="M6.947 11.948a2.895 2.895 0 1 0 0-5.79 2.895 2.895 0 0 0 0 5.79m0 1.052a3.947 3.947 0 1 1 0-7.895 3.947 3.947 0 0 1 0 7.895" />
      <Path d="M9.053 9.842a2.895 2.895 0 1 0 0-5.79 2.895 2.895 0 0 0 0 5.79m0 1.053a3.947 3.947 0 1 1 0-7.895 3.947 3.947 0 0 1 0 7.895" />
      <Path d="M9.183 10.895c.274-.332.47-.72.574-1.138.418-.104.806-.3 1.138-.574-.015.483-.12.96-.307 1.405a3.9 3.9 0 0 1-1.405.307m-2.94-4.652c-.417.104-.806.3-1.138.574.016-.483.12-.96.307-1.405a3.9 3.9 0 0 1 1.405-.307c-.274.332-.47.72-.574 1.138" />
    </G>
    <Defs>
      <ClipPath id="clip0_149_671">
        <Path fill="#fff" d="M3 3h10v10H3z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgCelo;
