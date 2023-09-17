import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEyeDropper = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.1 3.667a3.502 3.502 0 1 1 6.782 1.738 3.487 3.487 0 0 1-.907 1.57 3.495 3.495 0 0 1-1.617.919L16 7.99V10a.75.75 0 0 1-.22.53l-.25.25a.75.75 0 0 1-1.06 0l-.845-.844L7.22 16.34a2.25 2.25 0 0 1-1.591.66H5.12a.75.75 0 0 0-.53.22l-1.56 1.56a.75.75 0 0 1-1.061 0l-.75-.75a.75.75 0 0 1 0-1.06l1.56-1.561a.75.75 0 0 0 .22-.53v-.508c0-.596.237-1.169.659-1.59l6.405-6.406-.844-.845a.75.75 0 0 1 0-1.06l.25-.25A.75.75 0 0 1 10 4h2.01l.09-.333zM4.72 13.84l6.405-6.405 1.44 1.439-6.406 6.405a.75.75 0 0 1-.53.22H5.12c-.258 0-.511.044-.75.129a2.25 2.25 0 0 0 .129-.75v-.508a.75.75 0 0 1 .22-.53z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEyeDropper;
