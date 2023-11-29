import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnimation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6Zm9.95 4c-1.38 0-2.374.73-3.104 1.614-.692.839-1.234 1.924-1.712 2.882l-.029.058c-.513 1.028-.962 1.915-1.494 2.56-.507.615-.988.886-1.561.886H8a1 1 0 1 0 0 2h.05c1.38 0 2.374-.729 3.104-1.614.692-.838 1.234-1.924 1.712-2.882l.029-.057c.513-1.028.962-1.915 1.494-2.56.507-.615.988-.887 1.561-.887H16a1 1 0 1 0 0-2h-.05Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnimation;
