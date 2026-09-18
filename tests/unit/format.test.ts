import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatSize,
  formatTime,
  progressPercent,
} from '../../src/renderer/src/lib/format';

describe('format', () => {
  it('durées lisibles', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min');
    expect(formatDuration(3725)).toBe('1 h 02');
    expect(formatDuration(200, 'audio')).toBe('3:20');
    expect(formatDuration(null)).toBe('');
  });
  it('temps de lecture', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3661)).toBe('1:01:01');
  });
  it('tailles', () => {
    expect(formatSize(500)).toBe('500 o');
    expect(formatSize(1536)).toBe('1.5 Ko');
    expect(formatSize(74212549)).toBe('71 Mo');
  });
  it('progression', () => {
    expect(progressPercent(400, 1000)).toBe(40);
    expect(progressPercent(0, 1000)).toBeNull();
    expect(progressPercent(50, null)).toBeNull();
    expect(progressPercent(2000, 1000)).toBe(100);
  });
});
