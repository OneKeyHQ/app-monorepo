import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHeartBeat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.999 4.426c1.617-1.283 3.472-1.665 5.17-1.286 1.928.43 3.563 1.822 4.342 3.763 1.604 4-.495 9.69-9.023 14.47l-.489.274-.488-.275C2.983 16.592.884 10.903 2.488 6.903 3.268 4.961 4.902 3.57 6.83 3.14c1.698-.379 3.552.003 5.169 1.286M9.086 11H7v2h2.914l.93-.93 2 3 2.07-2.07H17v-2h-2.914l-.93.93-2-3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHeartBeat;
