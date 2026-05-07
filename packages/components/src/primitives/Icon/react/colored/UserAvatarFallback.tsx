import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUserAvatarFallback = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_user_avatar_fallback)">
      <Path
        fill="#fff"
        d="M0 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12S0 18.627 0 12"
      />
      <Path
        fill="#000"
        fillOpacity={0.447}
        fillRule="evenodd"
        d="M12-.5c6.904 0 12.5 5.596 12.5 12.5S18.904 24.5 12 24.5-.5 18.904-.5 12 5.096-.5 12-.5m0 16.25c-2.993 0-5.479 1.257-7.144 3.25A9.98 9.98 0 0 0 12 22a9.98 9.98 0 0 0 7.144-3c-1.665-1.993-4.15-3.25-7.144-3.25m0-10.312a4.062 4.062 0 1 0 0 8.124 4.062 4.062 0 0 0 0-8.124"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_user_avatar_fallback">
        <Path
          fill="#fff"
          d="M0 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12S0 18.627 0 12"
        />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgUserAvatarFallback;
