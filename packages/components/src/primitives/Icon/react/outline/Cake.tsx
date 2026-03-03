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
      d="M14.121 2.879a3 3 0 0 1 0 4.243A3 3 0 0 1 13 7.825V9h7.5v6.677l-.5.199V22H4v-6.124l-.5-.2V9H11V7.825a3 3 0 0 1-1.121-.703 3 3 0 0 1 0-4.243L12 .758zM12 17.077l-2.5-1-2.5 1-1-.4V20h12v-3.323l-1 .4-2.5-1zm-6.5-2.755 1.5.6 2.5-1 2.5 1 2.5-1 2.5 1 1.5-.6V11h-13zm5.793-10.029a1 1 0 1 0 1.414 0L12 3.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCake;
