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
      d="m23.236 14.282-5.51 3.444-3.444 5.51-5.51-14.465zm-8.517 4.482 1.555-2.49 2.49-1.555-6.535-2.49z"
      clipRule="evenodd"
    />
    <Path d="M7.818 15.596 5.344 18.07 3.93 16.656l2.474-2.474zM5.5 12H2v-2h3.5zm2.318-5.596L6.404 7.818 3.93 5.344 5.344 3.93zM18.07 5.343l-2.474 2.474-1.414-1.414 2.474-2.474zM12 5.5h-2V2h2z" />
  </Svg>
);
export default SvgCursorClick;
