// Jest setup file
// This file runs before each test file

// Mock @xenova/transformers which is ESM-only and breaks Jest
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue({
    extract: jest.fn().mockResolvedValue({
      data: Float32Array.from({ length: 384 }, () => Math.random() - 0.5),
      dims: [1, 384],
      type: 'float32',
      size: 384,
    }),
  }),
  env: {},
}));

// Mock console.error and console.log to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  // console.error = jest.fn();
  // console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Clean up between tests
afterEach(() => {
  jest.clearAllMocks();
});
