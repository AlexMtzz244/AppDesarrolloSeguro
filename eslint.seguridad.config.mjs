// Analisis estatico de seguridad (SAST) de SecureCampus, SC-LAB-009.
//
// Es el equivalente de Bandit en el laboratorio (que es de Python) para este
// proyecto en TypeScript. Se ejecuta APARTE de `pnpm lint`: lint mide calidad
// y estilo; este archivo busca patrones potencialmente inseguros. Mezclarlos
// haria que una advertencia de seguridad se perdiera entre las de estilo.
//
//   pnpm sast
//
// Alcance: solo el codigo que llega a produccion (src). Las pruebas se excluyen
// porque ahi se construyen a proposito entradas hostiles y objetos dinamicos.
//
// eslint-plugin-security no tiene niveles de severidad ni de confianza como
// Bandit (-ll -ii): todas sus reglas son "warn" y, segun su propio README,
// "encuentra muchos falsos positivos que requieren revision humana". Por eso
// aqui todo hallazgo es `error` y se resuelve de una de dos formas:
//   1. se corrige el codigo, o
//   2. se justifica en el propio codigo con un comentario
//      `eslint-disable-next-line security/<regla> -- <por que no es explotable>`.
// No se apagan reglas completas para conseguir una marca verde.
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

const reglasComoError = Object.fromEntries(
  Object.keys(security.configs.recommended.rules).map((regla) => [regla, 'error']),
);

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
    ],
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/web/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { security },
    // Una directiva `eslint-disable` que ya no suprime nada es un control
    // muerto: se reporta para que no se acumulen justificaciones obsoletas.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: reglasComoError,
  },
  {
    // Las mismas dos reglas de hooks que `pnpm lint`, solo para que las
    // directivas `eslint-disable react-hooks/...` que ya existen en la web no se
    // reporten aqui como inexistentes o sin efecto.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
