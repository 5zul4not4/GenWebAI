import {genkit} from 'genkit';
import {openAI} from 'genkitx-openai';
import {config} from 'dotenv';

config();

export const ai = genkit({
  plugins: [
    openAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
  model: 'openai/gpt-4.1-mini',

});
