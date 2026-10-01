module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/Backup/', '<rootDir>/archive/']
};
