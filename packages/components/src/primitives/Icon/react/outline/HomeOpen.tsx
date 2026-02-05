import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 3.647 5.036 9.523v9.487h3.98v-3.98c0-1.098.89-1.99 1.99-1.99h1.989a1.99 1.99 0 0 1 1.99 1.99v3.98h3.98V9.523zm8.954 15.363a1.99 1.99 0 0 1-1.99 1.99h-3.98a1.99 1.99 0 0 1-1.99-1.99v-3.98h-1.989v3.98A1.99 1.99 0 0 1 9.015 21h-3.98a1.99 1.99 0 0 1-1.99-1.99V9.523c0-.586.26-1.142.707-1.52l6.965-5.876a1.99 1.99 0 0 1 2.566 0l6.965 5.876c.448.378.706.934.706 1.52z" />
  </Svg>
);
export default SvgHomeOpen;
