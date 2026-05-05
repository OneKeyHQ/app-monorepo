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
      d="M14.122 2.878A3 3 0 0 1 13 7.83V9h7.5v6.677l-.5.2V22H4v-6.123l-.5-.2V9H11V7.829a3 3 0 0 1-1.121-4.95L12 .756zM5.5 14.323l1.5.6 2.5-1 2.5 1 2.5-1 2.5 1 1.5-.6V11h-13v3.322Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCake;
