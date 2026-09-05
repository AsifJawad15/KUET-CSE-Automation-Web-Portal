import next from 'eslint-config-next/core-web-vitals';
export default [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'tv-player-app/**', 'scratch/**'] },
  { rules: {
    '@next/next/no-img-element': 'off',
    // Compiler migration rules are independent of the existing React 18 code.
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
  } },
];
