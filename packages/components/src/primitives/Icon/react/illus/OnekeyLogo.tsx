import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyLogo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 28 28" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_34420_34332)">
      <Path
        fill="#44D62C"
        d="M27.91 13.955c0 9.634-4.321 13.955-13.955 13.955S0 23.589 0 13.955 4.321 0 13.955 0 27.91 4.321 27.91 13.955"
      />
      <Path
        fill="#000"
        d="M15.216 5.917h-3.882l-.681 2.06h2.156v4.338h2.407z"
      />
      <Path
        fill="#000"
        fillRule="evenodd"
        d="M18.383 17.565a4.427 4.427 0 1 1-8.855 0 4.427 4.427 0 0 1 8.855 0m-2.01 0a2.417 2.417 0 1 1-4.835 0 2.417 2.417 0 0 1 4.834 0"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_34420_34332">
        <Path fill="#fff" d="M0 0h28v28H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgOnekeyLogo;
