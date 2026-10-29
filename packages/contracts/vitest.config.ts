import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Solo las fuentes: `dist/` contiene la copia compilada de las mismas
    // pruebas, y vitest 4 ya no la excluye por omision.
    include: ['src/**/*.spec.ts'],
  },
});
