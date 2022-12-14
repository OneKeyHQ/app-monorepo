import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgQuestionMarkCircle = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <Path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 0 1-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 0 1-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502a2.28 2.28 0 0 0 .503-.331c.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQuestionMarkCircle;
