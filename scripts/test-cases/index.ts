import { TEST_CASES_CORE } from './tier1-3';
import { TEST_CASES_TIER4 } from './tier4';
import { TEST_CASES_TIER5 } from './tier5';
import { TEST_CASES_TIER6 } from './tier6';
import { TEST_CASES_TIER7 } from './tier7';
import { TEST_CASES_TIER8 } from './tier8';
import { TEST_CASES_TIER9 } from './tier9';
import { TEST_CASES_TIER10 } from './tier10';
import { TEST_CASES_BOSS } from './bosses';
import type { MissionTestCases } from './types';

export type { CorrectCase, MissionTestCases, WrongCase } from './types';

export const MISSION_TEST_CASES: Record<string, MissionTestCases> = {
  ...TEST_CASES_CORE,
  ...TEST_CASES_TIER4,
  ...TEST_CASES_TIER5,
  ...TEST_CASES_TIER6,
  ...TEST_CASES_TIER7,
  ...TEST_CASES_TIER8,
  ...TEST_CASES_TIER9,
  ...TEST_CASES_TIER10,
  ...TEST_CASES_BOSS,
};
