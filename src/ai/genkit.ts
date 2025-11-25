import {genkit} from 'genkit';
import {openAI} from 'genkitx-openai';
import {config} from 'dotenv';
import { currentModel } from './model';

config();

export const ai = genkit({
  plugins: [
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
  model: currentModel,
});
