import { render, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render correctly', () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onPress={onClick}>Click</Button>);
    
    fireEvent.click(getByText('Click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when loading', () => {
    const { getByTestId } = render(<Button loading testID="button">Loading</Button>);
    expect(getByTestId('button')).toBeDisabled();
  });
});
