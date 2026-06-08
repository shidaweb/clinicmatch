import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';
import typographyPlugin from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,json,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--aw-color-primary)',
        secondary: 'var(--aw-color-secondary)',
        accent: 'var(--aw-color-accent)',
        default: 'var(--aw-color-text-default)',
        muted: 'var(--aw-color-text-muted)',
        brand: {
          600: 'var(--brand-600)',
          800: 'var(--brand-800)',
        },
        cream: 'var(--cream)',
        ivory: 'var(--ivory)',
        blush: 'var(--blush)',
        rose: {
          DEFAULT: 'var(--rose)',
          deep: 'var(--rose-deep)',
        },
        plum: {
          DEFAULT: 'var(--plum)',
          soft: 'var(--plum-soft)',
        },
        sage: 'var(--sage)',
        gold: 'var(--gold)',
        line: 'var(--line)',
        danger: 'var(--danger)',
        dot: 'var(--dot)',
        ink: {
          muted: 'var(--color-muted)',
        },
        'accent-market': 'var(--accent-600)',
        sell: 'var(--color-sell)',
        buy: 'var(--color-buy)',
        done: 'var(--color-done)',
        sellTag: {
          bg: 'var(--color-sell-bg)',
          text: 'var(--color-sell-text)',
        },
        buyTag: {
          bg: 'var(--color-buy-bg)',
          text: 'var(--color-buy-text)',
        },
        doneTag: {
          bg: 'var(--color-done-bg)',
          text: 'var(--color-done-text)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
        },
        border: 'var(--color-border)',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
        float: 'var(--shadow-float)',
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        pill: '999px',
        card: '16px',
        input: '10px',
      },
      maxWidth: {
        content: 'var(--max-content)',
      },
      fontFamily: {
        sans: ['var(--aw-font-sans, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--aw-font-serif, ui-serif)', ...defaultTheme.fontFamily.serif],
        heading: ['var(--aw-font-heading, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
      },

      animation: {
        fade: 'fadeInUp 1s both',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(2rem)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    typographyPlugin,
    plugin(({ addVariant }) => {
      addVariant('intersect', '&:not([no-intersect])');
    }),
  ],
  darkMode: 'class',
};
