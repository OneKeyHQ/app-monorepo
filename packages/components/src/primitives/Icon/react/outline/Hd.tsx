import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"
    />
    <Path
      fill="currentColor"
      d="M6.116 15.622c-.659 0-1.035-.39-1.035-1.084V9.416c0-.693.376-1.084 1.035-1.084.66 0 1.035.39 1.035 1.084v1.714h2.48V9.416c0-.693.377-1.084 1.036-1.084.66 0 1.035.39 1.035 1.084v5.122c0 .693-.376 1.084-1.035 1.084-.66 0-1.035-.39-1.035-1.084v-1.763h-2.48v1.763c0 .693-.377 1.084-1.036 1.084Zm7.598-.122c-.66 0-1.035-.39-1.035-1.084V9.538c0-.693.376-1.084 1.035-1.084h1.977c2.14 0 3.394 1.216 3.394 3.472 0 2.256-1.26 3.574-3.394 3.574h-1.977Zm1.035-1.646h.65c1.035 0 1.577-.63 1.577-1.928 0-1.187-.586-1.826-1.578-1.826h-.649v3.755Z"
    />
  </Svg>
);
export default SvgHd;
