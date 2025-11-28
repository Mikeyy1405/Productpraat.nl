import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        exclude: [
            'node_modules',
            'dist',
            'src/cms/__tests__/**', // Exclude legacy tests that use Jest globals
        ],
    },
});
