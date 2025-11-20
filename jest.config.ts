import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFilesAfterEnv: ['./src/setupTests.ts'],
  transform: {
    // Usa o ts-jest diretamente, passando a opção useESM
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true, // Habilita o modo ESM dentro do transformador
      },
    ],
  },
  moduleNameMapper: {
    // Crucial para resolver imports corretamente em ESM
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;