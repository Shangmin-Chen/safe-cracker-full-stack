import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpCrackSafeGateway } from './adapters/http-crack-safe';
import { CRACK_SAFE_GATEWAY } from './crack-safe.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: CRACK_SAFE_GATEWAY, useClass: HttpCrackSafeGateway },
  ],
};
