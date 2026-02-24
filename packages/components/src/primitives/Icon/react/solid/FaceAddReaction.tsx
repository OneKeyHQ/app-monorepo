import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceAddReaction = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a10 10 0 0 1 3 .458V6h3v3h3.542c.297.947.458 1.955.458 3 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M7.174 14.356c.081.188.169.365.27.544.89 1.62 2.736 2.646 4.557 2.625 1.823.029 3.664-1.058 4.452-2.686.091-.18.167-.357.236-.545l-1.379-.588c-.066.13-.135.248-.212.367-.68 1.059-1.87 1.657-3.095 1.652-1.228.007-2.406-.653-2.994-1.715a4 4 0 0 1-.183-.366zM9.25 7.5c-.828 0-1.5.796-1.5 1.9 0 1.105.672 1.85 1.5 1.85s1.5-.745 1.5-1.85-.672-1.9-1.5-1.9m5.5 0c-.828 0-1.5.796-1.5 1.9 0 1.105.672 1.85 1.5 1.85s1.5-.745 1.5-1.85-.672-1.9-1.5-1.9"
      clipRule="evenodd"
    />
    <Path d="M21 3h3v2h-3v3h-2V5h-3V3h3V0h2z" />
  </Svg>
);
export default SvgFaceAddReaction;
