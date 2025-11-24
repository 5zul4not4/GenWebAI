'use server';

/**
 * @fileOverview This file defines the smart prompt assistant flow, which takes a user's website prompt and asks clarifying questions to improve website generation quality.
 *
 * - smartPromptAssistant - A function that initiates the smart prompt assistant flow.
 * - SmartPromptAssistantInput - The input type for the smartPromptAssistant function.
 * - SmartPromptAssistantOutput - The return type for the smartPromptAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

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
  prompt: `You are an expert prompt engineer for a static website generator. The user will provide an initial idea for a website.

Your job is to do two things:
1.  Generate a list of critical clarifying questions a user should consider to build a great website preview. These questions should cover:
    *   Target Audience & Purpose (e.g., "Who is this website for and what is its main goal?")
    *   Content & Pages (e.g., "What pages are essential: Home, About, Services, Contact?")
    *   Visual Style & Tone (e.g., "What is the desired aesthetic: modern, rustic, minimalist?")
    *   Key Features (e.g., "Should there be an image gallery, a contact form, or testimonials?")

2.  Based on the initial idea and the questions you just formulated, generate a new, comprehensive "refinedPrompt". This prompt must be optimized for a static HTML/CSS/JS generator. It must instruct the generator to:
    *   Create a high-fidelity, interactive, multi-page website experience.
    *   Use vanilla JavaScript for all interactivity (like a mobile menu or form handling).
    *   Style everything with Tailwind CSS.
    *   Clearly describe the pages, content, and style from the user's initial idea.

Initial User Idea: {{{websitePrompt}}}

Return a JSON object containing 'questionsToConsider' (an array of the questions you formulated) and 'refinedPrompt' (the new, detailed, and technically-specific prompt you generated).
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
