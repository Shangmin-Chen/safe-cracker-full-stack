export type CrackAlgorithm = 'positional' | 'backtracking';

export interface CrackProgress {
  attempts: number;
  currentCombination: string;
  timeTaken: number;
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
  return typeof value === 'string' && value.length === 10 && !/[^0-9]/.test(value);
}
