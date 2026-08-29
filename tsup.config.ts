import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: { entry: 'src/index.ts' },
  clean: true,
  sourcemap: true,
  // sharp and the ONNX runtimes ship platform-specific binaries; bundling them breaks
  // their loaders. onnxruntime-node is optional and may not be installed at all.
  external: ['sharp', 'onnxruntime-web', 'onnxruntime-node'],
});
