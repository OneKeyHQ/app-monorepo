import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBug = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17 7.17V7A5 5 0 0 0 7 7v.17c-.405.144-.77.372-1.074.663L3.564 7.05a1 1 0 1 0-.628 1.898l2.085.691A3.02 3.02 0 0 0 5 10v2H3a1 1 0 1 0 0 2h2v1c0 .43.039.85.113 1.259l-2.205.801a1 1 0 1 0 .684 1.88l2.158-.785A7.007 7.007 0 0 0 11 21.93V13a1 1 0 1 1 2 0v8.93a7.007 7.007 0 0 0 5.25-3.775l2.158.785a1 1 0 1 0 .684-1.88l-2.205-.801c.074-.409.113-.83.113-1.259v-1h2a1 1 0 1 0 0-2h-2v-2c0-.138-.01-.274-.027-.407l2.071-.637a1 1 0 0 0-.588-1.912l-2.427.747A3.001 3.001 0 0 0 17 7.17ZM12 4a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBug;
