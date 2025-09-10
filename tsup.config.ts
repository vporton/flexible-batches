import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'], // support both import/export and require()
  dts: true, // generate types
  sourcemap: true,
  clean: true, // clean dist before build
  minify: true,
});
