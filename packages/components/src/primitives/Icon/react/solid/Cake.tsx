import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCake = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.879 6.914a3 3 0 0 1 0-4.242l1.414-1.415a1 1 0 0 1 1.414 0l1.414 1.415A3 3 0 0 1 13 7.622v1.17h5.5a2 2 0 0 1 2 2v3.324a2 2 0 0 1-.5 1.323v4.354a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.354a2 2 0 0 1-.5-1.323v-3.323a2 2 0 0 1 2-2H11v-1.17a3 3 0 0 1-1.121-.709M5.5 10.793h13v3.323l-1.5.6-1.757-.703a2 2 0 0 0-1.486 0L12 14.716l-1.757-.703a2 2 0 0 0-1.486 0L7 14.716l-1.5-.6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCake;
