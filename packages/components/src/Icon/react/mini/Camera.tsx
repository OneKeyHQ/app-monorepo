import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCamera;
