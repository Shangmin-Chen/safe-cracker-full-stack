import type { CrackAlgorithm } from '../application/crack-safe';

export const ALGORITHM_INFO: Record<
  CrackAlgorithm,
  {
    name: string;
    summary: string;
    stages: string[];
    limit: string;
    example: string;
    hint: string;
  }
> = {
  positional: {
    name: 'Positional matching',
    summary:
      'Start with ten zeros. Try 0–9 at each position and keep a digit when the exact-position score increases.',
    stages: ['Score the starting guess', 'Improve one position at a time'],
    limit: 'Up to 101 scoring attempts',
    example: '0800666666',
    hint: 'Enter 10 digits. Repeated digits and leading zeros are supported.',
  },
  backtracking: {
    name: 'Backtracking',
    summary:
      'First discover every digit and its frequency. Then use backtracking to generate unique permutations until a complete guess opens the safe.',
    stages: ['Discover the digits', 'Backtrack through permutations'],
    limit: '10 discovery probes + complete permutations tested',
    example: '0800666666',
    hint: 'Enter 10 digits. The sound score counts shared digits, including repeats.',
  },
  regression: {
    name: 'Regression',
    summary:
      'Fill the unresolved positions with a candidate digit, flip the current position, and look for a score drop. Eliminate candidates and infer the last one.',
    stages: ['Flip a uniform sequence', 'Eliminate candidates', 'Infer the final code'],
    limit: 'At most 45 scoring probes; no extra opening attempt',
    example: '9876543210',
    hint: 'Use each digit 0–9 exactly once. The example takes 45 probes.',
  },
};
