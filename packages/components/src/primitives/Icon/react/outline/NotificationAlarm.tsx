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
      d="M4.602 1.982a1 1 0 0 1 .122 1.41 9.46 9.46 0 0 0-2.005 4.072 1 1 0 0 1-1.954-.427 11.46 11.46 0 0 1 2.428-4.932 1 1 0 0 1 1.409-.123m14.796 0a1 1 0 0 1 1.409.123 11.46 11.46 0 0 1 2.428 4.932 1 1 0 1 1-1.954.427 9.46 9.46 0 0 0-2.005-4.073 1 1 0 0 1 .122-1.409M4.216 8.816a7.853 7.853 0 0 1 15.568 0l.905 6.789A3 3 0 0 1 17.716 19h-1.07c-.904 1.748-2.607 3-4.646 3s-3.742-1.252-4.646-3h-1.07a3 3 0 0 1-2.973-3.396l.905-6.789ZM9.778 19c.61.637 1.399 1 2.222 1s1.613-.363 2.222-1zM12 4a5.85 5.85 0 0 0-5.802 5.08l-.905 6.788A1 1 0 0 0 6.284 17h11.432a1 1 0 0 0 .99-1.132l-.904-6.788A5.85 5.85 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationAlarm;
