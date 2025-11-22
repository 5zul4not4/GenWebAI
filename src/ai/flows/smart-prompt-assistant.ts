'use server';

/**
 * @fileOverview This file defines the smart prompt assistant flow, which takes a user's website prompt and asks clarifying questions to improve website generation quality.
 *
 * - smartPromptAssistant - A function that initiates the smart prompt assistant flow.
 * - SmartPromptAssistantInput - The input type for the smartPromptAssistant function.
 * - SmartPromptAssistantOutput - The return type for the smartPromptAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartPromptAssistantInputSchema = z.object({
  websitePrompt: z
    .string()
    .describe('The initial website prompt or idea provided by the user.'),
});
export type SmartPromptAssistantInput = z.infer<typeof SmartPromptAssistantInputSchema>;

const SmartPromptAssistantOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe(
      'The refined, detailed website prompt generated after considering the clarifying questions.'
    ),
  questionsToConsider: z
    .array(z.string())
    .describe(
      'A list of clarifying questions for the user to think about to further improve the prompt.'
    ),
});
export type SmartPromptAssistantOutput = z.infer<typeof SmartPromptAssistantOutputSchema>;

export async function smartPromptAssistant(
  input: SmartPromptAssistantInput
): Promise<SmartPromptAssistantOutput> {
  return smartPromptAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartPromptAssistantPrompt',
  input: {schema: SmartPromptAssistantInputSchema},
  output: {schema: SmartPromptAssistantOutputSchema},
  prompt: `You are an expert prompt engineer and website design consultant. The user will provide an initial idea or a basic prompt for a website.

Your job is to do two things:
1.  First, generate a list of critical clarifying questions a user should consider to build a great website. These questions should cover:
    *   Target Audience (e.g., "Who is this website for?")
    *   Core Purpose & Key Features (e.g., "What is the primary action you want users to take?")
    *   Content & Pages (e.g., "What pages are essential: Home, About, Services, Contact?")
    *   Visual Style & Tone (e.g., "What is the desired aesthetic: modern, rustic, minimalist?")
2.  Second, based on the initial idea and the questions you just formulated, generate a new, comprehensive, and detailed "refinedPrompt". This prompt should be a well-structured paragraph that incorporates best practices and serves as a high-quality starting point for website generation.

Initial User Idea: {{{websitePrompt}}}

Return a JSON object containing 'questionsToConsider' (an array of the questions you formulated) and 'refinedPrompt' (the new, detailed prompt you generated).
`,
});

const smartPromptAssistantFlow = ai.defineFlow(
  {
    name: 'smartPromptAssistantFlow',
    inputSchema: SmartPromptAssistantInputSchema,
    outputSchema: SmartPromptAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
