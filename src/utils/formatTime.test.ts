import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2:05');
  });

  it('handles zero and invalid numbers', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });

  it('handles sub-minute values', () => {
    expect(formatTime(9)).toBe('0:09');
  });
});
