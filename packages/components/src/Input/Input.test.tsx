import { render, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('should render correctly', () => {
    const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
    expect(getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should handle text input', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter text" onChangeText={onChangeText} />
    );
    
    const input = getByPlaceholderText('Enter text');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onChangeText).toHaveBeenCalledWith('test');
  });

  it('should be disabled when disabled prop is true', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter text" disabled />
    );
    expect(getByPlaceholderText('Enter text')).toBeDisabled();
  });
});
