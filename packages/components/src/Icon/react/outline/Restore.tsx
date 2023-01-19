import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRestore = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M7.977 9.348H2.984v-.001m16.985.518a8.25 8.25 0 0 0-13.804-3.7l-3.18 3.182m0-4.991v4.99M12 3.75A8.25 8.25 0 1 1 3.81 13"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgRestore;
