import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsconfigSpecPath = join(process.cwd(), 'tsconfig.spec.json');
const tsconfigSpec = JSON.parse(readFileSync(tsconfigSpecPath, 'utf-8'));
const compilerOptions = tsconfigSpec.compilerOptions;

// Map TypeScript paths to module name mapper
const moduleNameMapper = pathsToModuleNameMapper(compilerOptions.paths, {
  prefix: '<rootDir>/',
});

const config: Config.InitialOptions = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../.',
  testRegex: '/e2e/.*\\.(e2e-test|e2e-spec).(ts|tsx|js)$',
  moduleNameMapper,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  testEnvironment: 'node',
};

export default config;
