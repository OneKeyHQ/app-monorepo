import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArchive = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M20 8h1a1 1 0 0 0-1-1v1ZM4 8V7a1 1 0 0 0-1 1h1Zm1.092 11.782.454-.891-.454.891Zm-.874-.874.891-.454-.891.454Zm15.564 0-.891-.454.891.454Zm-.874.874-.454-.891.454.891ZM3 4V3a1 1 0 0 0-1 1h1Zm18 0h1a1 1 0 0 0-1-1v1Zm0 4v1a1 1 0 0 0 1-1h-1ZM3 8H2a1 1 0 0 0 1 1V8Zm7 3a1 1 0 1 0 0 2v-2Zm4 2a1 1 0 1 0 0-2v2Zm5-5v8.8h2V8h-2Zm-2.2 11H7.2v2h9.6v-2ZM5 16.8V8H3v8.8h2ZM4 9h16V7H4v2Zm3.2 10c-.577 0-.949 0-1.232-.024-.272-.022-.373-.06-.422-.085l-.908 1.782c.378.193.772.264 1.167.296.384.032.851.031 1.395.031v-2ZM3 16.8c0 .544 0 1.011.03 1.395.033.395.104.789.297 1.167l1.782-.908c-.025-.05-.063-.15-.085-.422C5 17.75 5 17.377 5 16.8H3Zm2.546 2.091a1 1 0 0 1-.437-.437l-1.782.908a3 3 0 0 0 1.311 1.311l.908-1.782ZM19 16.8c0 .577 0 .949-.024 1.232-.022.272-.06.372-.085.422l1.782.908c.193-.378.264-.772.296-1.167.032-.384.031-.851.031-1.395h-2ZM16.8 21c.544 0 1.011 0 1.395-.03.395-.033.789-.104 1.167-.297l-.908-1.782c-.05.025-.15.063-.422.085C17.75 19 17.377 19 16.8 19v2Zm2.091-2.546a1 1 0 0 1-.437.437l.908 1.782a3 3 0 0 0 1.311-1.311l-1.782-.908ZM3 5h18V3H3v2Zm17-1v4h2V4h-2Zm1 3H3v2h18V7ZM4 8V4H2v4h2Zm6 5h4v-2h-4v2Z"
    />
  </Svg>
);
export default SvgArchive;
