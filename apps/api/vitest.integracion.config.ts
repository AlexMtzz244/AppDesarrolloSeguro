import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // El transpilador es SWC y no el esbuild que trae vitest por omision, porque
  // esbuild NO implementa `emitDecoratorMetadata`: acepta la opcion y la
  // ignora. Sin `design:paramtypes` Nest no puede resolver ningun constructor,
  // asi que la aplicacion real no llega a levantar y las pruebas quedan en
  // `skipped` sin que nada se ponga rojo.
  //
  // Es exactamente el modo de fallo que este proyecto persigue en el codigo:
  // un control que parece estar y no esta. Las 13 pruebas negativas del prompt
  // maestro son requisito de producto, y unas pruebas que no corren son peores
  // que ninguna, porque el verde falso desactiva la vigilancia.
  plugins: [swc.vite({ module: { type: 'es6' } })],
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
});
