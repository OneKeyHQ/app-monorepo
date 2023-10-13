import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 7h1.43a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.57 4h2.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 17.57 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgCamera;
