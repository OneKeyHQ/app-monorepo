export type IPtChartScrubAreaProps = {
  width: number;
  height: number;
  /** x inside the area, in points */
  onScrub: (x: number) => void;
  onScrubEnd: () => void;
};
