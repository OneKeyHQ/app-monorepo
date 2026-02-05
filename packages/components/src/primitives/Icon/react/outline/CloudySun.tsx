import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudySun = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 10a3 3 0 0 0-5.75-1.2 7 7 0 0 1 2.508 2.219c.069.1.249.183.432.138a5.5 5.5 0 0 1 2.582-.008c.146-.353.228-.74.228-1.149m5-1.5a1 1 0 1 1 0 2h-.5a1 1 0 1 1 0-2zM8.988 3.49a1 1 0 0 1 1.414 0l.354.353a1 1 0 0 1-1.414 1.414l-.354-.354a1 1 0 0 1 0-1.414Zm10.606 0a1 1 0 0 1 1.414 1.413l-.354.354a1 1 0 1 1-1.414-1.414zM14 2.5V2a1 1 0 1 1 2 0v.5a1 1 0 1 1-2 0M4 15a5 5 0 0 0 5 5h7.5a3.5 3.5 0 1 0-.836-6.9c-.922.226-1.972-.108-2.55-.943A4.99 4.99 0 0 0 9 10a5 5 0 0 0-5 5m16-5c0 .694-.143 1.357-.4 1.959A5.5 5.5 0 0 1 16.5 22H9a7 7 0 1 1 1.36-13.866A5 5 0 0 1 20 10" />
  </Svg>
);
export default SvgCloudySun;
