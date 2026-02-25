import {
  createEventEmitter,
  EventEmitter,
} from './eventUtils';

describe('eventUtils', () => {
  describe('EventEmitter', () => {
    it('should create EventEmitter', () => {
      const emitter = createEventEmitter();
      expect(emitter).toBeInstanceOf(EventEmitter);
    });

    it('should subscribe and emit events', () => {
      const emitter = createEventEmitter();
      const listener = jest.fn();
      
      emitter.on('test', listener);
      emitter.emit('test', 'data');
      
      expect(listener).toHaveBeenCalledWith('data');
    });

    it('should unsubscribe from events', () => {
      const emitter = createEventEmitter();
      const listener = jest.fn();
      
      emitter.on('test', listener);
      emitter.off('test', listener);
      emitter.emit('test', 'data');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle once listener', () => {
      const emitter = createEventEmitter();
      const listener = jest.fn();
      
      emitter.once('test', listener);
      emitter.emit('test', 'data');
      emitter.emit('test', 'data2');
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
