import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next 16 supplies flat configs directly. Formatting runs through Prettier CLI.
const config = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'docs/**'] },
  {
    rules: {
      'no-console': 'warn',
      semi: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/member-ordering': 'error',
    },
  },
];
export default config;
