import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFile1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.586 2a2 2 0 0 1 .24.016 1 1 0 0 1 .994.412q.094.073.18.158L19.414 8q.084.085.157.18a1 1 0 0 1 .412.994 2 2 0 0 1 .017.24V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM6 20h12V10h-4a2 2 0 0 1-2-2V4H6zm8-12h2.586L14 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFile1;
