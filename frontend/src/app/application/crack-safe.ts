export type CrackAlgorithm = 'positional' | 'backtracking' | 'regression';
export const COMBINATION_LENGTH = 10;

export interface CrackProgress {
  attempts: number;
  currentCombination: string;
  timeTaken: number;
  phase?: 'baseline' | 'position' | 'discovery' | 'permutation' | 'regression' | 'inferred';
  score?: number | null;
  baselineScore?: number | null;
  position?: number | null;
  discoveredDigits?: string;
  fixedPrefix?: string;
}

export interface CrackResult {
  attempts: number;
  crackedCombination: string;
  timeTaken: number;
  success: boolean;
}

export interface CrackSafeGateway {
  readAlgorithm(algorithm: CrackAlgorithm, signal: AbortSignal): Promise<string>;
  run(
    target: string,
    algorithm: CrackAlgorithm,
    onProgress: (progress: CrackProgress) => void,
    signal: AbortSignal,
  ): Promise<CrackResult>;
}

export function isCombination(value: unknown): value is string {
  return typeof value === 'string' && value.length === COMBINATION_LENGTH && !/[^0-9]/.test(value);
}

export function isPermutation(value: unknown): value is string {
  return isCombination(value) && new Set(value).size === COMBINATION_LENGTH;
}
