import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // `e2e/` es de Playwright, no de vitest. Sin esta exclusion, vitest
    // intenta ejecutar las pruebas de navegador y falla al no encontrar su
    // runner.
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
