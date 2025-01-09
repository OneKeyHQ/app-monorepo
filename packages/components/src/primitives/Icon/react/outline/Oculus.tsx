import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOculus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 9h2m8.472 1.028L22.5 9m-1.028 1.028A5.003 5.003 0 0 0 16.566 6H7.434a5.003 5.003 0 0 0-4.906 4.028m18.944 0C22.155 13.49 20.445 18 16.4 18H7.601c-4.046 0-5.757-4.51-5.073-7.972M1.5 9l1.028 1.028"
    />
  </Svg>
);
export default SvgOculus;
