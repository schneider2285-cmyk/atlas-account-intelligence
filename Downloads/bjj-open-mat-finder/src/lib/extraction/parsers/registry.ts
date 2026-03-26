import type { ScheduleParser } from '../types';
import { kicksiteParser } from './kicksite';
import { zenPlannerParser } from './zenplanner';
import { mindbodyParser } from './mindbody';
import { genericHtmlParser } from './generic-html';

/**
 * Ordered list of parsers. Platform-specific parsers run first
 * (higher confidence). Generic parser is always last (fallback).
 */
export const parsers: ScheduleParser[] = [
  kicksiteParser,
  zenPlannerParser,
  mindbodyParser,
  genericHtmlParser,
];
