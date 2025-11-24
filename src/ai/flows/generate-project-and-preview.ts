
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating both a website preview and a full project in parallel.
 *
 * It orchestrates two separate flows to improve performance by running them concurrently.
 *
 * It exports:
 *   - generateProjectAndPreview - The main function to trigger the combined generation flow.
 *   - GenerateProjectAndPreviewInput - The input type for the function.
 *   - GenerateProjectAndPreviewOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {
  generateWebsitePreview,
  GenerateWebsitePreviewOutput,
  GenerateWebsitePreviewInput,
} from './generate-website-from-prompt';
import {
  generateFullProject,
  GenerateFullProjectOutput,
  GenerateFullProjectInput,
} from './generate-full-project';

const GenerateProjectAndPreviewInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the desired website.'),
  logoDataUri: z.optional(z.string()).describe('Optional: A data URI of a logo to be included and used for theming.'),
});
export type GenerateProjectAndPreviewInput = z.infer<typeof GenerateProjectAndPreviewInputSchema>;

const GenerateProjectAndPreviewOutputSchema = z.object({
  preview: GenerateWebsitePreviewOutput,
  fullProject: GenerateFullProjectOutput,
});
export type GenerateProjectAndPreviewOutput = z.infer<typeof GenerateProjectAndPreviewOutputSchema>;


export async function generateProjectAndPreview(
  input: GenerateProjectAndPreviewInput
): Promise<GenerateProjectAndPreviewOutput> {
    return generateProjectAndPreviewFlow(input);
}


const generateProjectAndPreviewFlow = ai.defineFlow(
  {
    name: 'generateProjectAndPreviewFlow',
    inputSchema: GenerateProjectAndPreviewInputSchema,
    outputSchema: GenerateProjectAndPreviewOutputSchema,
  },
  async (input: GenerateProjectAndPreviewInput) => {
    // Run both flows in parallel to speed up the generation process
    const [previewResult, fullProjectResult] = await Promise.all([
      generateWebsitePreview(input as GenerateWebsitePreviewInput),
      generateFullProject(input as GenerateFullProjectInput),
    ]);

    return {
      preview: previewResult,
      fullProject: fullProjectResult,
    };
  }
);
