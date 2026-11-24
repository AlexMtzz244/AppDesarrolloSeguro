// Configuracion unica de ESLint para todo el monorepo. Cada paquete ejecuta
// `eslint src --max-warnings 0` y ESLint encuentra este archivo subiendo
// directorios. Sin el, `pnpm lint` fallaba en CI con "eslint: not found" y la
// etapa de calidad quedaba roja sin verificar nada.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // SC-LAB-009: las reglas de seguridad NO se activan aqui, viven en
    // `eslint.seguridad.config.mjs` (`pnpm sast`). Se registra el plugin solo
    // para que las directivas `eslint-disable security/...` del codigo, que
    // justifican cada falso positivo, no se lean como reglas inexistentes. Por
    // la misma razon se desactiva el aviso de directivas sin efecto: aqui las
    // reglas de seguridad estan apagadas, asi que parecerian sobrantes. Ese
    // control si esta activo, y en `error`, en el analisis de seguridad.
    plugins: { security },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    // Solo las dos reglas clasicas de hooks; el preset completo de la v7 trae
    // las reglas del React Compiler, que este proyecto no usa.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    rules: {
      // Un parametro o variable que empieza por `_` es intencionalmente no usado.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
