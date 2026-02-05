import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.382l3.83-1.915A1.5 1.5 0 0 1 22 7.809v8.382a1.5 1.5 0 0 1-2.17 1.341L16 15.618V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm14 7.382 4 2V8.617l-4 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCamera;
