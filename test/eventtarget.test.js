import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import EventTarget from '../src/js/eventtarget.js';

describe('EventTarget', () => {
  it('adds and dispatches event listeners', () => {
    const target = new EventTarget();
    const handler = mock.fn();

    target.addEventListener('test-event', handler);
    target.dispatchEvent({ type: 'test-event', data: 'hello' });

    assert.strictEqual(handler.mock.callCount(), 1);
    assert.deepStrictEqual(handler.mock.calls[0].arguments[0], {
      type: 'test-event',
      data: 'hello'
    });
  });

  it('supports multiple listeners for the same event type', () => {
    const target = new EventTarget();
    const handler1 = mock.fn();
    const handler2 = mock.fn();

    target.addEventListener('custom', handler1);
    target.addEventListener('custom', handler2);
    target.dispatchEvent({ type: 'custom' });

    assert.strictEqual(handler1.mock.callCount(), 1);
    assert.strictEqual(handler2.mock.callCount(), 1);
  });

  it('removes event listeners', () => {
    const target = new EventTarget();
    const handler = mock.fn();

    target.addEventListener('ping', handler);
    target.dispatchEvent({ type: 'ping' });
    assert.strictEqual(handler.mock.callCount(), 1);

    target.removeEventListener('ping', handler);
    target.dispatchEvent({ type: 'ping' });
    assert.strictEqual(handler.mock.callCount(), 1);
  });

  it('safely handles removeEventListener for non-existent events', () => {
    const target = new EventTarget();
    assert.doesNotThrow(() => {
      target.removeEventListener('unknown', () => {});
    });
  });

  it('ignores events dispatched without a type property', () => {
    const target = new EventTarget();
    const handler = mock.fn();
    target.addEventListener('something', handler);
    target.dispatchEvent({});
    assert.strictEqual(handler.mock.callCount(), 0);
  });

  it('does nothing when dispatching event with no listeners', () => {
    const target = new EventTarget();
    assert.doesNotThrow(() => {
      target.dispatchEvent({ type: 'unhandled' });
    });
  });
});
