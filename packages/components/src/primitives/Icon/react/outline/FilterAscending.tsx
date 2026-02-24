import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterAscending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8 17.336 2-2 1.414 1.414L7 21.164 2.586 16.75 4 15.336l2 2V3h2zm13-2.422L16.914 19H21v2h-7v-1.914L18.086 15H14v-2h7z" />
    <Path
      fillRule="evenodd"
      d="M20.923 8.115 21 8.3V11h-2V9.5h-3V11h-2V8.3l.077-.185L16.208 3h2.584l2.13 5.115ZM16.5 7.5h2l-1-2.4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFilterAscending;
