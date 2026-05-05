import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationAlarm = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a7.85 7.85 0 0 1 7.784 6.815l.905 6.789A3 3 0 0 1 17.716 19h-1.07c-.904 1.748-2.608 3-4.646 3-2.039 0-3.742-1.252-4.647-3H6.284a3 3 0 0 1-2.974-3.396l.906-6.789A7.85 7.85 0 0 1 12 2M9.778 19c.61.637 1.399 1 2.222 1s1.613-.363 2.222-1z"
      clipRule="evenodd"
    />
    <Path d="M3.192 2.104a1 1 0 0 1 1.532 1.288 9.46 9.46 0 0 0-2.005 4.072 1 1 0 0 1-1.954-.427 11.46 11.46 0 0 1 2.427-4.933m16.206-.122a1 1 0 0 1 1.409.122 11.46 11.46 0 0 1 2.428 4.933 1 1 0 0 1-1.954.427 9.47 9.47 0 0 0-2.006-4.072 1 1 0 0 1 .123-1.41" />
  </Svg>
);
export default SvgNotificationAlarm;
