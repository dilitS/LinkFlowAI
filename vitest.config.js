import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // jsdom gives us a DOM for the security/rendering regression tests.
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
        globals: true
    }
});
