import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBnbCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 32 32" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_15_271)">
      <Path
        fill="#F3BA2F"
        d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16"
      />
      <Path
        fill="#fff"
        d="M12.116 14.404 16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144zM6 16l2.26-2.26L10.52 16l-2.26 2.26zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003zM21.48 16l2.26-2.26L26 16l-2.26 2.26zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293z"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_15_271">
        <Path fill="#fff" d="M0 0h32v32H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgBnbCircle;
