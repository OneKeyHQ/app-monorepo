import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleShadow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.5 6.5a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0m4 0A2.5 2.5 0 0 0 15 4a1 1 0 0 1 0-2 4.5 4.5 0 1 1 0 9 1 1 0 0 1 0-2 2.5 2.5 0 0 0 2.5-2.5m-.372 13.58c-.525.58-1.306.92-2.128.92H3c-.82 0-1.603-.34-2.127-.92-.542-.6-.802-1.461-.501-2.362C1.497 14.344 4.994 12 9 12s7.503 2.344 8.63 5.718c.3.9.04 1.763-.502 2.362M21 21c.821 0 1.603-.34 2.128-.92.541-.599.802-1.461.501-2.362-.798-2.39-2.793-4.266-5.295-5.152a1 1 0 0 0-.668 1.885c2 .709 3.488 2.169 4.066 3.9.049.146.021.267-.088.389A.88.88 0 0 1 21 19h-.5a1 1 0 1 0 0 2z"
    />
  </Svg>
);
export default SvgPeopleShadow;
