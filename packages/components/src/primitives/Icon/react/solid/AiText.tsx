import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 5a1 1 0 0 0 0 2h16a1 1 0 1 0 0-2H4Zm13.92 4.606a1 1 0 0 0-1.84 0l-1.342 3.132-3.132 1.343a1 1 0 0 0 0 1.838l3.132 1.343 1.343 3.132a1 1 0 0 0 1.838 0l1.343-3.132 3.132-1.343a1 1 0 0 0 0-1.838l-3.132-1.343-1.343-3.132ZM4 11a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H4Zm0 6a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H4Z"
    />
  </Svg>
);
export default SvgAiText;
