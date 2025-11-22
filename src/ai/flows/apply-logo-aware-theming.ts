'use server';
/**
 * @fileOverview Applies logo-aware theming to a website.
 *
 * - applyLogoAwareTheming - A function that handles the logo-aware theming process.
 * - ApplyLogoAwareThemingInput - The input type for the applyLogoAwareTheming function.
 * - ApplyLogoAwareThemingOutput - The return type for the applyLogoAwareTheming function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ApplyLogoAwareThemingInputSchema = z.object({
  logoDataUri: z
    .string()
    .describe(
      'A logo image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' 
    ),
});
export type ApplyLogoAwareThemingInput = z.infer<typeof ApplyLogoAwareThemingInputSchema>;

const ApplyLogoAwareThemingOutputSchema = z.object({
  primaryColor: z.string().describe('The primary color extracted from the logo.'),
  secondaryColor: z.string().describe('The secondary color extracted from the logo.'),
  accentColor: z.string().describe('The accent color extracted from the logo.'),
});
export type ApplyLogoAwareThemingOutput = z.infer<typeof ApplyLogoAwareThemingOutputSchema>;

export async function applyLogoAwareTheming(input: ApplyLogoAwareThemingInput): Promise<ApplyLogoAwareThemingOutput> {
  return applyLogoAwareThemingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'applyLogoAwareThemingPrompt',
  input: {schema: ApplyLogoAwareThemingInputSchema},
  output: {schema: ApplyLogoAwareThemingOutputSchema},
  prompt: `You are an expert web designer. Extract the dominant colors from the provided logo and suggest a color scheme for a website.

Logo: {{media url=logoDataUri}}

Return a JSON object with the primaryColor, secondaryColor and accentColor. The color should be returned as a hex code.
`,
});

const applyLogoAwareThemingFlow = ai.defineFlow(
  {
    name: 'applyLogoAwareThemingFlow',
    inputSchema: ApplyLogoAwareThemingInputSchema,
    outputSchema: ApplyLogoAwareThemingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
