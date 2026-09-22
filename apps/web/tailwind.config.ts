import type { Config } from 'tailwindcss';

/**
 * Tema de SecureCampus.
 *
 * El prompt maestro pide un diseno "sobrio, de herramienta academica/operativa:
 * denso pero legible, sin texto explicativo decorativo ni controles que oculten
 * riesgos". La paleta es neutra y el acento se reserva para lo que de verdad
 * lo necesita.
 *
 * Los colores semanticos de estado importan por una razon de seguridad, no
 * estetica: una calificacion en borrador y una publicada deben distinguirse de
 * un vistazo, y una accion destructiva no debe parecerse a una ordinaria.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        borde: 'hsl(var(--borde))',
        entrada: 'hsl(var(--entrada))',
        anillo: 'hsl(var(--anillo))',
        fondo: 'hsl(var(--fondo))',
        texto: 'hsl(var(--texto))',
        primario: {
          DEFAULT: 'hsl(var(--primario))',
          contraste: 'hsl(var(--primario-contraste))',
        },
        tenue: {
          DEFAULT: 'hsl(var(--tenue))',
          contraste: 'hsl(var(--tenue-contraste))',
        },
        panel: {
          DEFAULT: 'hsl(var(--panel))',
          contraste: 'hsl(var(--panel-contraste))',
        },
        peligro: {
          DEFAULT: 'hsl(var(--peligro))',
          contraste: 'hsl(var(--peligro-contraste))',
        },
        aviso: {
          DEFAULT: 'hsl(var(--aviso))',
          contraste: 'hsl(var(--aviso-contraste))',
        },
        exito: {
          DEFAULT: 'hsl(var(--exito))',
          contraste: 'hsl(var(--exito-contraste))',
        },
      },
      borderRadius: {
        lg: 'var(--radio)',
        md: 'calc(var(--radio) - 2px)',
        sm: 'calc(var(--radio) - 4px)',
      },
      fontFamily: {
        sans: ['var(--fuente-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
