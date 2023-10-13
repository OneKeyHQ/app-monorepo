import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCallOutgoing = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 3C4.383 3 2.91 4.344 3.132 6.12c.958 7.695 7.055 13.791 14.75 14.75 1.776.22 3.12-1.251 3.12-2.87v-1.312a3 3 0 0 0-2.138-2.873l-1.531-.46a2.825 2.825 0 0 0-2.81.709c-.266.266-.609.283-.826.149a12.067 12.067 0 0 1-3.908-3.908c-.135-.218-.118-.56.149-.827a2.825 2.825 0 0 0 .708-2.81l-.46-1.53A3 3 0 0 0 7.313 3H6.001Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V6.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L17.586 5H16a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCallOutgoing;
