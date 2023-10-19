import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCopy1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 4.25A2.25 2.25 0 0 1 4.25 2h9.5A2.25 2.25 0 0 1 16 4.25V8h3.75A2.25 2.25 0 0 1 22 10.25v9.5A2.25 2.25 0 0 1 19.75 22h-9.5A2.25 2.25 0 0 1 8 19.75V16H4.25A2.25 2.25 0 0 1 2 13.75v-9.5ZM14 8h-3.75A2.25 2.25 0 0 0 8 10.25V14H4.25a.25.25 0 0 1-.25-.25v-9.5A.25.25 0 0 1 4.25 4h9.5a.25.25 0 0 1 .25.25V8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCopy1;
