'use server';

/**
 * @fileOverview A flow to regenerate a specific section of a website based on user instructions.
 *
 * - regenerateWebsiteSection - A function that handles the regeneration of a specific website section.
 * - RegenerateWebsiteSectionInput - The input type for the regenerateWebsiteSection function.
 * - RegenerateWebsiteSectionOutput - The return type for the regenerateWebsiteSection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const RegenerateWebsiteSectionInputSchema = z.object({
  websiteContent: z
    .string()
    .describe('The current content of the entire website as a string.'),
  instructions: z
    .string()
    .describe('Specific instructions for regenerating the website.'),
});
export type RegenerateWebsiteSectionInput = z.infer<
  typeof RegenerateWebsiteSectionInputSchema
>;

const RegenerateWebsiteSectionOutputSchema = z.object({
  updatedWebsiteContent: z
    .string()
    .describe('The complete updated content of the website.'),
});
export type RegenerateWebsiteSectionOutput = z.infer<
  typeof RegenerateWebsiteSectionOutputSchema
>;

export async function regenerateWebsiteSection(
  input: RegenerateWebsiteSectionInput
): Promise<RegenerateWebsiteSectionOutput> {
  return regenerateWebsiteSectionFlow(input);
}

const regenerateWebsiteSectionPrompt = ai.definePrompt({
  name: 'regenerateWebsiteSectionPrompt',
  input: {schema: RegenerateWebsiteSectionInputSchema},
  output: {schema: RegenerateWebsiteSectionOutputSchema},
  prompt: `You are an AI website assistant. The user wants to update their website preview based on new instructions.

Your task:
- Analyze the user's instructions and apply them to the current website content.
- The instructions may apply to one or more sections. Modify all relevant parts.
- Preserve all other sections exactly as they are.
- Output the FULL updated website content.
- Do NOT add explanations or comments.

Current Website Content:
{{{websiteContent}}}

Instructions for changes:
{{{instructions}}}

IMPORTANT RULES:
1. Apply all changes described in the instructions.
2. Do NOT modify any other part of the website that isn't mentioned in the instructions.
3. Keep the original structure, classes, IDs, layout, and formatting unless the instructions require changes.
4. Maintain indentation and spacing cleanly.
5. You MUST return a JSON object with a single key 'updatedWebsiteContent' containing the full HTML. Do NOT return raw HTML.
`,
});

const regenerateWebsiteSectionFlow = ai.defineFlow(
  {
    name: 'regenerateWebsiteSectionFlow',
    inputSchema: RegenerateWebsiteSectionInputSchema,
    outputSchema: RegenerateWebsiteSectionOutputSchema,
  },
  async input => {
    const {output} = await regenerateWebsiteSectionPrompt(input);
    return output!;
  }
);
