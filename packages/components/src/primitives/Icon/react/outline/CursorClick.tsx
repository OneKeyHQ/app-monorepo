import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursorClick = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.236 14.281-5.51 3.445-3.445 5.51-5.51-14.465zm-8.518 4.483 1.556-2.49 2.49-1.556-6.535-2.49z"
      clipRule="evenodd"
    />
    <Path d="M7.818 15.596 5.343 18.07l-1.414-1.414 2.474-2.475 1.415 1.414ZM5.5 12H2v-2h3.5zm2.318-5.596L6.403 7.818 3.93 5.343l1.414-1.414 2.475 2.475Zm10.253-1.061-2.475 2.475-1.414-1.415 2.475-2.474zM12 5.5h-2V2h2z" />
  </Svg>
);
export default SvgCursorClick;
