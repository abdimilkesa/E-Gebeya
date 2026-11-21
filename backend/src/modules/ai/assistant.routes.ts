import { assistantChatSchema } from '@marketplace/contracts';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { assistantUnavailable } from '../../lib/errors.js';
import { parseBody, sendData } from '../../lib/http.js';
import { aiChatLimiter } from '../../middleware/rate-limit.js';
import { runAssistantTurn } from './assistant.service.js';
import { createGeminiModel } from './gemini-model.js';

export const assistantRouter = Router();

assistantRouter.post('/chat', aiChatLimiter, async (req, res) => {
  const input = parseBody(assistantChatSchema, req);
  const model = createGeminiModel();
  if (!model) {
    req.log.warn('shopping assistant is not configured');
    throw assistantUnavailable();
  }
  const started = Date.now();
  const result = await runAssistantTurn(
    {
      message: input.message,
      history: input.history,
      origin: input.location ?? null,
    },
    model,
    (event) => req.log.info(event, 'assistant tool'),
  );
  req.log.info({ durationMs: Date.now() - started, model: env.GEMINI_MODEL }, 'assistant turn');
  sendData(res, result);
});
