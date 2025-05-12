import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationAlarm = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a7.85 7.85 0 0 0-7.784 6.815l-.905 6.789A3 3 0 0 0 6.284 19h1.07c.904 1.748 2.607 3 4.646 3s3.742-1.252 4.646-3h1.07a3 3 0 0 0 2.973-3.396l-.905-6.789A7.85 7.85 0 0 0 12 2m2.222 17H9.778c.61.637 1.399 1 2.222 1s1.613-.363 2.222-1M4.602 1.982a1 1 0 0 1 .122 1.41 9.46 9.46 0 0 0-2.005 4.072 1 1 0 0 1-1.954-.427 11.46 11.46 0 0 1 2.428-4.932 1 1 0 0 1 1.409-.123m14.796 0a1 1 0 0 1 1.409.123 11.46 11.46 0 0 1 2.428 4.932 1 1 0 1 1-1.954.427 9.46 9.46 0 0 0-2.005-4.073 1 1 0 0 1 .122-1.409"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationAlarm;
