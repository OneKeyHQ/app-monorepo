import { MOBILE_POSITION_ACTION_TEXT_SIZE } from './positionActionPresentation';

describe('position action presentation', () => {
  it('uses the shared mobile text size', () => {
    expect(MOBILE_POSITION_ACTION_TEXT_SIZE).toBe('$bodySm');
  });
});
