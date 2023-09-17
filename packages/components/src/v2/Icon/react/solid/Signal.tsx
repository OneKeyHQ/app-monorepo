import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSignal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.343 4.929a1 1 0 0 1 0 1.414A7.972 7.972 0 0 0 4 12a7.97 7.97 0 0 0 2.343 5.657A1 1 0 1 1 4.93 19.07 9.972 9.972 0 0 1 2 12a9.972 9.972 0 0 1 2.929-7.071 1 1 0 0 1 1.414 0Zm11.314 0a1 1 0 0 1 1.414 0A9.972 9.972 0 0 1 22 11.999a9.972 9.972 0 0 1-2.929 7.072 1 1 0 0 1-1.414-1.414A7.972 7.972 0 0 0 20 12a7.97 7.97 0 0 0-2.343-5.657 1 1 0 0 1 0-1.414ZM9.172 7.757a1 1 0 0 1 0 1.415A3.984 3.984 0 0 0 8 12c0 1.105.447 2.103 1.172 2.828a1 1 0 1 1-1.415 1.415A5.984 5.984 0 0 1 6 12c0-1.657.673-3.158 1.757-4.243a1 1 0 0 1 1.415 0Zm5.656 0a1 1 0 0 1 1.415 0A5.984 5.984 0 0 1 18 12a5.984 5.984 0 0 1-1.757 4.243 1 1 0 0 1-1.415-1.415A3.984 3.984 0 0 0 16 12a3.984 3.984 0 0 0-1.172-2.828 1 1 0 0 1 0-1.415ZM10 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSignal;
