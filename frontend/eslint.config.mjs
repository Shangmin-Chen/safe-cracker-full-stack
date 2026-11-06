import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig({
  files: ['src/**/*.html'],
  extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
});
