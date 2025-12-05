import { describe, it, expect, beforeEach } from 'vitest';
import { geminiCliActionsInputs } from './inputs';

const ALL_INPUTS: Record<string, string | boolean> = {
  INPUT_GCP_LOCATION: 'us-central1',
  INPUT_GCP_PROJECT_ID: 'my-project',
  INPUT_GCP_SERVICE_ACCOUNT: 'sa@project.iam.gserviceaccount.com',
  INPUT_GCP_WORKLOAD_IDENTITY_PROVIDER: 'projects/123/locations',
  INPUT_GCP_TOKEN_FORMAT: 'access_token',
  INPUT_GCP_ACCESS_TOKEN_SCOPES: 'scope1,scope2',
  INPUT_GEMINI_API_KEY: 'gemini-key',
  INPUT_GEMINI_CLI_VERSION: 'latest',
  INPUT_GEMINI_DEBUG: 'true',
  INPUT_GEMINI_MODEL: 'gemini-pro',
  INPUT_GOOGLE_API_KEY: 'google-key',
  INPUT_PROMPT: 'hello world',
  INPUT_SETTINGS: '{}',
  INPUT_USE_GEMINI_CODE_ASSIST: true,
  INPUT_USE_VERTEX_AI: false,
  INPUT_EXTENSIONS: 'ext1,ext2',
  INPUT_UPLOAD_ARTIFACTS: true,
  INPUT_USE_PNPM: false,
  INPUT_WORKFLOW_NAME: 'test-workflow',
};

const EMPTY_OUTPUT = {
  gcpLocation: '',
  gcpProjectId: '',
  gcpServiceAccount: '',
  gcpWorkloadIdentityProvider: '',
  gcpTokenFormat: '',
  gcpAccessTokenScopes: '',
  geminiApiKey: '',
  geminiCliVersion: '',
  geminiDebug: '',
  geminiModel: '',
  googleApiKey: '',
  prompt: '',
  settings: '',
  useGeminiCodeAssist: false,
  useVertexAi: false,
  extensions: '',
  uploadArtifacts: false,
  usePnpm: false,
  workflowName: '',
};

const EXPECTED_OUTPUT = {
  gcpLocation: 'us-central1',
  gcpProjectId: 'my-project',
  gcpServiceAccount: 'sa@project.iam.gserviceaccount.com',
  gcpWorkloadIdentityProvider: 'projects/123/locations',
  gcpTokenFormat: 'access_token',
  gcpAccessTokenScopes: 'scope1,scope2',
  geminiApiKey: 'gemini-key',
  geminiCliVersion: 'latest',
  geminiDebug: 'true',
  geminiModel: 'gemini-pro',
  googleApiKey: 'google-key',
  prompt: 'hello world',
  settings: '{}',
  useGeminiCodeAssist: true,
  useVertexAi: false,
  extensions: 'ext1,ext2',
  uploadArtifacts: true,
  usePnpm: false,
  workflowName: 'test-workflow',
};

describe('geminiCliActionsInputs', () => {
  beforeEach(() => {
    process.env = {};
  });

  /**
   * This is particularly written this way so that if new input is added in input.ts
   * the test will fail if not added in this test
   */
  it.each([
    [
      'should return empty values when no environment variables are set',
      {},
      EMPTY_OUTPUT,
    ],
    ['should map all inputs correctly', ALL_INPUTS, EXPECTED_OUTPUT],
  ])('%s', (_, allInputsMap, expected) => {
    for (const [key, value] of Object.entries(allInputsMap)) {
      process.env[key] = value.toString();
    }

    const inputs = geminiCliActionsInputs();
    expect(inputs).toEqual(expected);
  });
});
