// Jest setup file
// This file runs before each test file

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
