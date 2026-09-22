import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: false,
  },
  esbuild: {
    // NestJS depende de los decoradores heredados y de la metadata que emite
    // TypeScript. Sin esto, la prueba estructural de politicas no encontraria
    // ninguna ruta y pasaria en verde sin verificar nada.
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
