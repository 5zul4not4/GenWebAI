'use server';
/**
 * @fileOverview This file defines a Genkit flow for brainstorming a website prompt from a structured set of answers.
 *
 * It takes multiple inputs from a user form and synthesizes them into a detailed, structured prompt.
 *
 * It exports:
 *   - brainstormPrompt - The main function to trigger the brainstorming flow.
 *   - BrainstormPromptInput - The input type for the function.
 *   - BrainstormPromptOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const BrainstormPromptInputSchema = z.object({
  purpose: z.string().describe('The core purpose of the website and its primary goal.'),
  audience: z.string().describe('The target audience for the website.'),
  style: z.string().describe('The desired visual style, tone, and aesthetic (e.g., "warm and rustic", "modern and minimalist").'),
  pages: z.string().describe('A list of the essential pages the website should have (e.g., Home, About Us, Products, Contact).'),
  features: z.string().describe('Any specific features or interactive elements needed (e.g., "a contact form," "an image gallery").'),
});
export type BrainstormPromptInput = z.infer<typeof BrainstormPromptInputSchema>;

const BrainstormPromptOutputSchema = z.object({
  brainstormedPrompt: z
    .string()
    .describe('A detailed, structured prompt generated from the user\'s answers.'),
});
export type BrainstormPromptOutput = z.infer<typeof BrainstormPromptOutputSchema>;

export async function brainstormPrompt(
  input: BrainstormPromptInput
): Promise<BrainstormPromptOutput> {
  return brainstormPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'brainstormPrompt',
  input: {schema: BrainstormPromptInputSchema},
  output: {schema: BrainstormPromptOutputSchema},
  prompt: `You are an expert prompt engineer and website design consultant. A user has provided answers to several questions about their desired website. Your task is to synthesize these answers into a single, comprehensive, and well-structured prompt that can be used to generate a high-quality website.

Here are the user's answers:
- Core Purpose & Goal: {{{purpose}}}
- Target Audience: {{{audience}}}
- Visual Style & Tone: {{{style}}}
- Key Pages: {{{pages}}}
- Required Features & Functionality: {{{features}}}

Your task:
- Combine all user answers into one cohesive, polished paragraph.
- Begin with the website’s primary purpose and audience.
- Then describe the visual style, personality, and UI tone.
- Then list the key pages in a natural, descriptive way.
- Finally describe required features and functionality.
- Ensure the prompt is detailed, clear, and directly usable for generating a full high-quality website.
- Do NOT ask questions.
- Do NOT mention that you are rewriting anything.
- Output ONLY the final synthesized prompt text.

Return the result inside this field:
{
  "brainstormedPrompt": "FINAL_GENERATED_PROMPT_HERE"
}
`,
});

const brainstormPromptFlow = ai.defineFlow(
  {
    name: 'brainstormPromptFlow',
    inputSchema: BrainstormPromptInputSchema,
    outputSchema: BrainstormPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
