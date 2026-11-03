// cspell:ignore schiff pitchfan gann xabcd Vwap
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const ADDITIONAL_DRAWING_TOOLS = {
  regression: {
    labelId: ETranslations.market_drawing_tool_regression__title,
    group: 'Lines',
    points: 2,
  },
  flatChannel: {
    labelId: ETranslations.market_drawing_tool_flat_channel__title,
    group: 'Lines',
    points: 3,
  },
  disjointChannel: {
    labelId: ETranslations.market_drawing_tool_disjoint_channel__title,
    group: 'Lines',
    points: 4,
  },
  pitchfork: {
    labelId: ETranslations.market_drawing_tool_pitchfork__title,
    group: 'Pitchforks',
    points: 3,
  },
  schiffPitchfork: {
    labelId: ETranslations.market_drawing_tool_schiff_pitchfork__title,
    group: 'Pitchforks',
    points: 3,
  },
  modifiedPitchfork: {
    labelId: ETranslations.market_drawing_tool_modified_pitchfork__title,
    group: 'Pitchforks',
    points: 3,
  },
  insidePitchfork: {
    labelId: ETranslations.market_drawing_tool_inside_pitchfork__title,
    group: 'Pitchforks',
    points: 3,
  },
  fibTrendTime: {
    labelId: ETranslations.market_drawing_tool_fib_trend_time__title,
    group: 'Fibonacci',
    points: 3,
  },
  fibCircles: {
    labelId: ETranslations.market_drawing_tool_fib_circles__title,
    group: 'Fibonacci',
    points: 2,
  },
  fibSpiral: {
    labelId: ETranslations.market_drawing_tool_fib_spiral__title,
    group: 'Fibonacci',
    points: 2,
  },
  fibArcs: {
    labelId: ETranslations.market_drawing_tool_fib_arcs__title,
    group: 'Fibonacci',
    points: 2,
  },
  fibWedge: {
    labelId: ETranslations.market_drawing_tool_fib_wedge__title,
    group: 'Fibonacci',
    points: 3,
  },
  pitchfan: {
    labelId: ETranslations.market_drawing_tool_pitchfan__title,
    group: 'Fibonacci',
    points: 3,
  },
  gannBox: {
    labelId: ETranslations.market_drawing_tool_gann_box__title,
    group: 'Gann',
    points: 2,
  },
  gannSquareFixed: {
    labelId: ETranslations.market_drawing_tool_gann_square_fixed__title,
    group: 'Gann',
    points: 2,
  },
  gannSquare: {
    labelId: ETranslations.market_drawing_tool_gann_square__title,
    group: 'Gann',
    points: 2,
  },
  gannFan: {
    labelId: ETranslations.market_drawing_tool_gann_fan__title,
    group: 'Gann',
    points: 2,
  },
  xabcd: {
    labelId: ETranslations.market_drawing_tool_xabcd__title,
    group: 'Patterns',
    points: 5,
  },
  cypher: {
    labelId: ETranslations.market_drawing_tool_cypher__title,
    group: 'Patterns',
    points: 5,
  },
  headShoulders: {
    labelId: ETranslations.market_drawing_tool_head_shoulders__title,
    group: 'Patterns',
    points: 7,
  },
  abcd: {
    labelId: ETranslations.market_drawing_tool_abcd__title,
    group: 'Patterns',
    points: 4,
  },
  trianglePattern: {
    labelId: ETranslations.market_drawing_tool_triangle_pattern__title,
    group: 'Patterns',
    points: 4,
  },
  threeDrives: {
    labelId: ETranslations.market_drawing_tool_three_drives__title,
    group: 'Patterns',
    points: 6,
  },
  elliottImpulse: {
    labelId: ETranslations.market_drawing_tool_elliott_impulse__title,
    group: 'Elliott Waves',
    points: 6,
  },
  elliottCorrection: {
    labelId: ETranslations.market_drawing_tool_elliott_correction__title,
    group: 'Elliott Waves',
    points: 4,
  },
  elliottTriangle: {
    labelId: ETranslations.market_drawing_tool_elliott_triangle__title,
    group: 'Elliott Waves',
    points: 6,
  },
  elliottDouble: {
    labelId: ETranslations.market_drawing_tool_elliott_double__title,
    group: 'Elliott Waves',
    points: 4,
  },
  elliottTriple: {
    labelId: ETranslations.market_drawing_tool_elliott_triple__title,
    group: 'Elliott Waves',
    points: 6,
  },
  cyclicLines: {
    labelId: ETranslations.market_drawing_tool_cyclic_lines__title,
    group: 'Cycles',
    points: 2,
  },
  timeCycles: {
    labelId: ETranslations.market_drawing_tool_time_cycles__title,
    group: 'Cycles',
    points: 2,
  },
  sineLine: {
    labelId: ETranslations.market_drawing_tool_sine_line__title,
    group: 'Cycles',
    points: 2,
  },
  longPosition: {
    labelId: ETranslations.market_drawing_tool_long_position__title,
    group: 'Projection',
    points: 1,
  },
  shortPosition: {
    labelId: ETranslations.market_drawing_tool_short_position__title,
    group: 'Projection',
    points: 1,
  },
  forecast: {
    labelId: ETranslations.market_drawing_tool_forecast__title,
    group: 'Projection',
    points: 2,
  },
  barsPattern: {
    labelId: ETranslations.market_drawing_tool_bars_pattern__title,
    group: 'Projection',
    points: 2,
  },
  ghostFeed: {
    labelId: ETranslations.market_drawing_tool_ghost_feed__title,
    group: 'Projection',
    points: 2,
  },
  projection: {
    labelId: ETranslations.market_drawing_tool_projection__title,
    group: 'Projection',
    points: 3,
  },
  anchoredVwap: {
    labelId: ETranslations.market_drawing_tool_anchored_vwap__title,
    group: 'Volume',
    points: 1,
  },
  volumeProfile: {
    labelId: ETranslations.market_drawing_tool_volume_profile__title,
    group: 'Volume',
    points: 2,
  },
  arrowMarker: {
    labelId: ETranslations.market_drawing_tool_arrow_marker__title,
    group: 'Shapes',
    points: 2,
  },
  arrowUp: {
    labelId: ETranslations.market_drawing_tool_arrow_up__title,
    group: 'Shapes',
    points: 1,
  },
  arrowDown: {
    labelId: ETranslations.market_drawing_tool_arrow_down__title,
    group: 'Shapes',
    points: 1,
  },
  arrowLeft: {
    labelId: ETranslations.market_drawing_tool_arrow_left__title,
    group: 'Shapes',
    points: 1,
  },
  arrowRight: {
    labelId: ETranslations.market_drawing_tool_arrow_right__title,
    group: 'Shapes',
    points: 1,
  },
  rotatedRectangle: {
    labelId: ETranslations.market_drawing_tool_rotated_rectangle__title,
    group: 'Shapes',
    points: 3,
  },
  path: {
    labelId: ETranslations.market_drawing_tool_path__title,
    group: 'Shapes',
    points: 2,
  },
  circle: {
    labelId: ETranslations.market_drawing_tool_circle__title,
    group: 'Shapes',
    points: 2,
  },
  polyline: {
    labelId: ETranslations.market_drawing_tool_polyline__title,
    group: 'Shapes',
    points: 2,
  },
  arc: {
    labelId: ETranslations.market_drawing_tool_arc__title,
    group: 'Shapes',
    points: 3,
  },
  curve: {
    labelId: ETranslations.market_drawing_tool_curve__title,
    group: 'Shapes',
    points: 3,
  },
  doubleCurve: {
    labelId: ETranslations.market_drawing_tool_double_curve__title,
    group: 'Shapes',
    points: 4,
  },
  anchoredText: {
    labelId: ETranslations.market_drawing_tool_anchored_text__title,
    group: 'Text',
    points: 1,
  },
  note: {
    labelId: ETranslations.market_drawing_tool_note__title,
    group: 'Text',
    points: 1,
  },
  priceNote: {
    labelId: ETranslations.market_drawing_tool_price_note__title,
    group: 'Text',
    points: 2,
  },
  pin: {
    labelId: ETranslations.market_drawing_tool_pin__title,
    group: 'Text',
    points: 1,
  },
  table: {
    labelId: ETranslations.market_drawing_tool_table__title,
    group: 'Text',
    points: 1,
  },
  comment: {
    labelId: ETranslations.market_drawing_tool_comment__title,
    group: 'Text',
    points: 1,
  },
  signpost: {
    labelId: ETranslations.market_drawing_tool_signpost__title,
    group: 'Text',
    points: 2,
  },
  flag: {
    labelId: ETranslations.market_drawing_tool_flag__title,
    group: 'Text',
    points: 1,
  },
  emoji: {
    labelId: ETranslations.market_drawing_tool_emoji__title,
    group: 'Icons',
    points: 1,
  },
  sticker: {
    labelId: ETranslations.market_drawing_tool_sticker__title,
    group: 'Icons',
    points: 1,
  },
  icon: {
    labelId: ETranslations.market_drawing_tool_icon__title,
    group: 'Icons',
    points: 1,
  },
} as const;

export type IAdditionalDrawingTool = keyof typeof ADDITIONAL_DRAWING_TOOLS;
