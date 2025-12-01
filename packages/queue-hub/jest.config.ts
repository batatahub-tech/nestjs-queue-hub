import { readFileSync } from 'fs';
import { join } from 'path';
import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsconfigSpecPath = join(process.cwd(), 'tsconfig.spec.json');
const tsconfigSpec = JSON.parse(readFileSync(tsconfigSpecPath, 'utf-8'));
const compilerOptions = tsconfigSpec.compilerOptions;

const moduleNameMapper = compilerOptions.paths
  ? pathsToModuleNameMapper(compilerOptions.paths, {
      prefix: '<rootDir>/',
    })
  : {};

const config: Config.InitialOptions = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: './',
  testRegex: '/lib/.*\\.(test|spec).(ts|tsx|js)$',
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
