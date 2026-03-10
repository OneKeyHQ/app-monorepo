import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallIncoming = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.13 8.285 9.537 9.876a12.06 12.06 0 0 0 4.586 4.586l1.17-1.169.422-.423L21 14.456V21h-1C10.611 21 3 13.389 3 4V3h6.544zM5.034 5C5.527 12.488 11.512 18.473 19 18.966v-3.023l-2.716-.814-1.772 1.773-.642-.312a14.05 14.05 0 0 1-6.46-6.46l-.312-.642L8.87 7.715 8.056 5z"
      clipRule="evenodd"
    />
    <Path d="m21.414 4-4 4H20v2h-6V4h2v2.586l4-4z" />
  </Svg>
);
export default SvgCallIncoming;
