import type { ScheduleParser } from '../types';
import { kicksiteParser } from './kicksite';
import { genericHtmlParser } from './generic-html';

/**
 * Ordered list of parsers. Platform-specific parsers run first
 * (higher confidence). Generic parser is always last (fallback).
 */
export const parsers: ScheduleParser[] = [
  kicksiteParser,
  genericHtmlParser,
];
