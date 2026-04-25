// Jest setup file
// This file runs before each test file

// Mock @xenova/transformers which is ESM-only and breaks Jest
const mockEmbeddingData = new Float32Array(384);
for (let i = 0; i < 384; i++) mockEmbeddingData[i] = Math.random() - 0.5;

const mockPipelineResult = {
  data: mockEmbeddingData,
  dims: [1, 384],
  type: 'float32',
  size: 384,
};

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    // The pipeline returns a callable function: pipe(text, options) => { data, dims }
    jest.fn().mockResolvedValue(mockPipelineResult),
  ),
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
