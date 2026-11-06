import { InjectionToken } from '@angular/core';
import type { CrackSafeGateway } from './application/crack-safe';

export const CRACK_SAFE_GATEWAY = new InjectionToken<CrackSafeGateway>('CrackSafeGateway');
