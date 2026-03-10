import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiftTopView = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h6v-4.162a14 14 0 0 1-2.458 2.002l-.84.543-1.085-1.68.841-.543A12 12 0 0 0 9.98 13H5zm9.02-6a12 12 0 0 0 2.522 2.16l.84.542-1.084 1.68-.84-.542A14 14 0 0 1 13 14.838V19h6v-6zM5 11h2.4A3.66 3.66 0 0 1 7 9.333 2.333 2.333 0 0 1 9.333 7c.6 0 1.167.145 1.667.4V5H5zm4.333-2A.333.333 0 0 0 9 9.333c0 .92.746 1.667 1.667 1.667H11v-.333l-.009-.17A1.667 1.667 0 0 0 9.333 9m5.334 0C13.747 9 13 9.746 13 10.667V11h.333c.92 0 1.667-.746 1.667-1.667A.333.333 0 0 0 14.667 9M13 7.4a3.66 3.66 0 0 1 1.667-.4A2.333 2.333 0 0 1 17 9.333c0 .6-.145 1.167-.4 1.667H19V5h-6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGiftTopView;
