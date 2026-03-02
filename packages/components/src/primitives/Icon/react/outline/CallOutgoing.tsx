import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallOutgoing = (props: SvgProps) => (
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
    <Path d="M21 9h-2V6.414l-4 4L13.586 9l4-4H15V3h6z" />
  </Svg>
);
export default SvgCallOutgoing;
