import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageQuestion = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12.022 11.663c.102-.676.48-1.042.86-1.3.37-.252.742-.58.742-1.185 0-.837-.672-1.515-1.5-1.515-.83 0-1.5.678-1.5 1.515m1.374 11.358 2.74-2.27a1 1 0 0 1 .638-.23h2.626a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-12a2 2 0 0 0-2 2v10.036a2 2 0 0 0 2 2h2.65a1 1 0 0 1 .642.233l2.704 2.267Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M11.125 14.5a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgMessageQuestion;
