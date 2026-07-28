import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';

import { shouldShowProtocolPositionActionInlineSubmitError } from './protocolPositionActionErrorUtils';

describe('protocolPositionActionErrorUtils', () => {
  it('keeps local submit validation errors inline', () => {
    expect(
      shouldShowProtocolPositionActionInlineSubmitError(
        new OneKeyLocalError('Invalid DeFi action amount'),
      ),
    ).toBe(true);
  });

  it('does not inline auto-toast errors', () => {
    const error = new OneKeyLocalError({
      message: 'Failed to submit',
      autoToast: true,
    });

    expect(shouldShowProtocolPositionActionInlineSubmitError(error)).toBe(
      false,
    );
  });

  it('does not inline server API errors even after toast suppression mutated autoToast', () => {
    const error = new OneKeyServerApiError({
      message: 'build transaction failed',
      autoToast: false,
    });

    expect(shouldShowProtocolPositionActionInlineSubmitError(error)).toBe(
      false,
    );
  });

  it('does not inline network or HTTP response errors', () => {
    const error = Object.assign(new Error('Network Error'), {
      response: { status: 502 },
    });

    expect(shouldShowProtocolPositionActionInlineSubmitError(error)).toBe(
      false,
    );
  });

  it('does not inline wrapped tx-confirm errors', () => {
    const error = new OneKeyLocalError('simulation failed');
    error.cause = new Error('inner simulation failed');

    expect(shouldShowProtocolPositionActionInlineSubmitError(error)).toBe(
      false,
    );
  });
});
