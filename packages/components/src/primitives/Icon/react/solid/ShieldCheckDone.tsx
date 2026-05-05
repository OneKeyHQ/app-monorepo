import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 5.036v6.876c0 2.807-1.149 4.83-2.813 6.404-1.572 1.489-3.632 2.6-5.555 3.637l-.632.34-.632-.34c-1.923-1.037-3.983-2.148-5.556-3.637C4.15 16.741 3 14.72 3 11.912V5.036l9-3.094zm-10 6.8-1.5-1.5-1.414 1.414L11 14.664l4.914-4.914L14.5 8.336z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShieldCheckDone;
