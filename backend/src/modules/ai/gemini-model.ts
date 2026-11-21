import { GoogleGenAI, type Content, type FunctionDeclaration } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { TOOL_DECLARATIONS } from './tools.js';
import type { AssistantModel, ModelContent, ModelTurn } from './assistant.service.js';

const declarations = TOOL_DECLARATIONS as unknown as FunctionDeclaration[];

/** Removes anything that looks like a provider key before a message is logged. */
function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'request failed';
  return message
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/AQ\.[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .slice(0, 200);
}

/**
 * Official Gemini client. Constructed only when GEMINI_API_KEY is set.
 * The key stays in this process. It is not returned to the browser.
 */
export function createGeminiModel(): AssistantModel | null {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({
    apiKey,
    // A busy model otherwise retries for about a minute and the browser sees a broken response.
    httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } },
  });
  const model = env.GEMINI_MODEL;

  return {
    async generate(input): Promise<ModelTurn> {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: input.contents as Content[],
          config: {
            systemInstruction: input.systemInstruction,
            temperature: 0.2,
            maxOutputTokens: 1024,
            // Gemini 3 Flash thinks at medium by default, which runs past a short timeout.
            // Low is the fastest level gemini-3.7-flash and gemini-3.8-flash both accept.
            thinkingConfig: { thinkingLevel: 'LOW' },
            ...(input.toolsEnabled
              ? { tools: [{ functionDeclarations: declarations }] }
              : {}),
          },
        });
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const fromParts = parts.flatMap((part) =>
          part.functionCall?.name
            ? [
                {
                  id: part.functionCall.id,
                  name: part.functionCall.name,
                  args: part.functionCall.args ?? {},
                  thoughtSignature: part.thoughtSignature,
                },
              ]
            : [],
        );
        const functionCalls =
          fromParts.length > 0
            ? fromParts
            : (response.functionCalls ?? []).flatMap((call) =>
                call.name ? [{ id: call.id, name: call.name, args: call.args ?? {} }] : [],
              );
        return { text: response.text?.trim() ?? '', functionCalls };
      } catch (error) {
        logger.error({ err: safeError(error) }, 'assistant provider request failed');
        throw error;
      }
    },
  };
}

export type { ModelContent };
