// AI SDK Anthropic Provider Configuration
// This is a workaround since @ai-sdk/anthropic may need to be installed separately

import { createAnthropic } from "@ai-sdk/anthropic";

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Default model for Canon AI queries
export const defaultModel = anthropic("claude-sonnet-4-20250514");

// Model for complex reasoning (physics calculations, attack path analysis)
export const reasoningModel = anthropic("claude-sonnet-4-20250514");
