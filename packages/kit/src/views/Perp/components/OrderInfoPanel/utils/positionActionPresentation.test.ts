import {
  ADD_POSITION_LABEL,
  MOBILE_POSITION_ACTION_TEXT_SIZE,
} from './positionActionPresentation';

describe('position action presentation', () => {
  it('uses the explicit English add-position label and shared mobile text size', () => {
    expect(ADD_POSITION_LABEL).toBe('Add Position');
    expect(MOBILE_POSITION_ACTION_TEXT_SIZE).toBe('$bodySm');
  });
});
