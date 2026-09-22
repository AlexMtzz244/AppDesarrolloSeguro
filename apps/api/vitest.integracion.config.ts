import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.spec.ts'],
    globals: false,
    // Las pruebas comparten una base de datos: si corrieran en paralelo se
    // pisarian los TRUNCATE entre archivos. La secuencialidad es el precio de
    // probar contra el motor real en vez de contra un doble.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'es2022',
        useDefineForClassFields: false,
      },
    },
  },
});
