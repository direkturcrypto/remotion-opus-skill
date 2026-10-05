#!/usr/bin/env node
// Thin launcher: run the TypeScript CLI through tsx so no build step is needed.
import { register } from 'tsx/esm/api';

register();
await import('../cli/index.ts');
