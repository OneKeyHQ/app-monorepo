import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldFailure = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 5.036v6.876c0 2.807-1.149 4.83-2.813 6.404-1.572 1.489-3.632 2.6-5.555 3.637l-.632.34-.632-.34c-1.923-1.037-3.983-2.148-5.556-3.637C4.15 16.741 3 14.72 3 11.912V5.036l9-3.094zm-9 5.05-2-2L8.586 9.5l2 2-2 2L10 14.914l2-2 2 2 1.414-1.414-2-2 2-2L14 8.086z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldFailure;
