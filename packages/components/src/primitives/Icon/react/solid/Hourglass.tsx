import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHourglass = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 4H4a1 1 0 0 1 0-2h16a1 1 0 1 1 0 2h-1v2.93a3 3 0 0 1-1.336 2.496L13.803 12l3.861 2.574A3 3 0 0 1 19 17.07V20h1a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2h1v-2.93a3 3 0 0 1 1.336-2.496L10.197 12 6.336 9.426A3 3 0 0 1 5 6.93zm2 0v2.93q0 .035.002.07h9.995L17 6.93V4zm10 14v-.93a1 1 0 0 0-.445-.832L12 13.202l-4.555 3.036A1 1 0 0 0 7 17.07V18z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHourglass;
