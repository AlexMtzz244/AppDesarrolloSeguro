import type { Config } from 'tailwindcss';

/**
 * Tema de SecureCampus, sobre el lenguaje de Fluent 2 (Windows 11).
 *
 * La interfaz adopta la estetica nativa de Windows 11: superficies Mica y
 * acrilico, esquinas de 4/8 px, elevacion por sombras en capas y movimiento
 * con las curvas de Fluent. El movimiento sirve para orientar (de donde viene
 * un panel, que entrada del menu esta activa), no para adornar, y se apaga
 * entero cuando el sistema pide menos movimiento.
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
        tarjeta: 'hsl(var(--tarjeta))',
        primario: {
          DEFAULT: 'hsl(var(--primario))',
          contraste: 'hsl(var(--primario-contraste))',
          suave: 'hsl(var(--primario-suave))',
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
        xl: '12px',
        lg: 'var(--radio-tarjeta)',
        md: 'var(--radio)',
        sm: 'calc(var(--radio) - 2px)',
      },
      fontFamily: {
        sans: ['var(--fuente-sans)'],
        mono: ['"Cascadia Code"', '"Cascadia Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      // Rampa de elevacion de Fluent 2: sombra ambiental + sombra de llave.
      boxShadow: {
        'elevacion-2': '0 0 2px rgb(0 0 0 / var(--sombra-amb)), 0 1px 2px rgb(0 0 0 / var(--sombra-llave))',
        'elevacion-4': '0 0 2px rgb(0 0 0 / var(--sombra-amb)), 0 2px 4px rgb(0 0 0 / var(--sombra-llave))',
        'elevacion-8': '0 0 2px rgb(0 0 0 / var(--sombra-amb)), 0 4px 8px rgb(0 0 0 / var(--sombra-llave))',
        'elevacion-16': '0 0 2px rgb(0 0 0 / var(--sombra-amb)), 0 8px 16px rgb(0 0 0 / var(--sombra-llave))',
        'elevacion-28': '0 0 8px rgb(0 0 0 / var(--sombra-amb)), 0 14px 28px rgb(0 0 0 / var(--sombra-llave))',
        'elevacion-64': '0 0 8px rgb(0 0 0 / var(--sombra-amb)), 0 32px 64px rgb(0 0 0 / var(--sombra-llave))',
      },
      transitionTimingFunction: {
        'fluent-decelerate': 'cubic-bezier(0.1, 0.9, 0.2, 1)',
        'fluent-accelerate': 'cubic-bezier(0.9, 0.1, 1, 0.2)',
        'fluent-standard': 'cubic-bezier(0.8, 0, 0.2, 1)',
      },
      transitionDuration: {
        rapido: '167ms',
        normal: '250ms',
        lento: '367ms',
      },
      keyframes: {
        entrada: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        crecer: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        barrido: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        deriva: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)' },
          '33%': { transform: 'translate3d(4%, -6%, 0) scale(1.08) rotate(8deg)' },
          '66%': { transform: 'translate3d(-5%, 4%, 0) scale(0.96) rotate(-6deg)' },
        },
        'giro-fluent': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'arco-fluent': {
          '0%': { strokeDasharray: '1 150', strokeDashoffset: '0' },
          '50%': { strokeDasharray: '90 150', strokeDashoffset: '-35' },
          '100%': { strokeDasharray: '90 150', strokeDashoffset: '-124' },
        },
        latido: {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      animation: {
        entrada: 'entrada 500ms cubic-bezier(0.1, 0.9, 0.2, 1) both',
        crecer: 'crecer 900ms cubic-bezier(0.1, 0.9, 0.2, 1) 200ms both',
        barrido: 'barrido 1.6s cubic-bezier(0.8, 0, 0.2, 1) infinite',
        deriva: 'deriva 28s ease-in-out infinite',
        'deriva-lenta': 'deriva 40s ease-in-out infinite reverse',
        'giro-fluent': 'giro-fluent 1.4s linear infinite',
        'arco-fluent': 'arco-fluent 1.4s ease-in-out infinite',
        latido: 'latido 1.8s cubic-bezier(0.1, 0.9, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
