import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinimize = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.957 3.043a1 1 0 0 1 0 1.414L16.414 9H20a1 1 0 1 1 0 2h-5a2 2 0 0 1-2-2V4a1 1 0 1 1 2 0v3.586l4.543-4.543a1 1 0 0 1 1.414 0ZM3 14a1 1 0 0 1 1-1h5a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0v-3.586l-4.543 4.543a1 1 0 0 1-1.414-1.414L7.586 15H4a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMinimize;
