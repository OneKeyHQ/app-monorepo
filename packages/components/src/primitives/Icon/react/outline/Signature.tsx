import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSignature = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.586 3.207a2 2 0 0 1 2.828 0L20 4.793a2 2 0 0 1 .138 2.676L20 7.62l-13 13a2 2 0 0 1-1.414.586H3a1 1 0 0 1-1-1V17.62a2 2 0 0 1 .586-1.414l13-13ZM4 17.621v1.586h1.586l13-13L17 4.621z"
      clipRule="evenodd"
    />
    <Path d="M20.243 17.553a1 1 0 0 1 1.514 1.307l-.002.002-.002.003-.006.007-.017.02-.059.064a7 7 0 0 1-.93.826c-.58.43-1.504.97-2.575.97-1.041 0-1.939-.498-2.568-.832-.724-.384-1.169-.598-1.612-.598-1.056 0-1.731.558-2.26 1.117a1 1 0 0 1-1.452-1.374c.653-.692 1.824-1.742 3.713-1.743 1.03 0 1.925.5 2.548.831.717.381 1.173.598 1.631.598.429 0 .923-.234 1.384-.575a5 5 0 0 0 .69-.62z" />
  </Svg>
);
export default SvgSignature;
