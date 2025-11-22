
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating an interactive website preview from a user prompt.
 *
 * This flow is designed to create a single HTML file that is a high-fidelity mockup.
 * It uses JS to simulate multi-page navigation and includes responsive CSS.
 *
 * It exports:
 *   - generateWebsitePreview - The main function to trigger the website preview generation flow.
 *   - GenerateWebsitePreviewInput - The input type for the function.
 *   - GenerateWebsitePreviewOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWebsitePreviewInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the desired website.'),
  logoDataUri: z.optional(z.string()).describe('Optional: A data URI of a logo to be included and used for theming.'),
  theme: z.optional(z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    accentColor: z.string(),
  })).describe('Optional: A color theme to apply to the website.'),
});
export type GenerateWebsitePreviewInput = z.infer<typeof GenerateWebsitePreviewInputSchema>;

const GenerateWebsitePreviewOutputSchema = z.object({
  previewContent: z
    .string()
    .describe('The generated single-file HTML content of the website preview.'),
});
export type GenerateWebsitePreviewOutput = z.infer<
  typeof GenerateWebsitePreviewOutputSchema
>;

export async function generateWebsitePreview(
  input: GenerateWebsitePreviewInput
): Promise<GenerateWebsitePreviewOutput> {
  return generateWebsitePreviewFlow(input);
}

const generateWebsitePreviewPrompt = ai.definePrompt({
  name: 'generateWebsitePreviewPrompt',
  input: {schema: GenerateWebsitePreviewInputSchema},
  output: {schema: GenerateWebsitePreviewOutputSchema},
  prompt: `You are an expert frontend developer specializing in high-quality interactive UI.  
Generate a SINGLE, SELF-CONTAINED HTML FILE (HTML + Tailwind CSS via CDN + JavaScript) that serves as a HIGH-FIDELITY, RESPONSIVE, INTERACTIVE PREVIEW of a full website based on the user's prompt.  
This preview must look professional, polished, and simulate a real multi-page website.

User Prompt: {{{prompt}}}

{{#if logoDataUri}}
<!-- THEME + LOGO -->
<style>
  :root {
    --color-primary: {{{theme.primaryColor}}};
    --color-accent: {{{theme.accentColor}}};
  }
  .bg-primary { background-color: var(--color-primary); }
  .text-primary { color: var(--color-primary); }
  .border-primary { border-color: var(--color-primary); }
  .bg-accent { background-color: var(--color-accent); }
  .text-accent { color: var(--color-accent); }
  .ring-accent { --tw-ring-color: var(--color-accent); }
</style>
{{/if}}

===================================================
STRICT RULES — MUST FOLLOW EXACTLY
===================================================

1. **Single File Only**
   - Everything must be in ONE HTML file.
   - Only Tailwind CDN for CSS.
   - No external CSS/JS files.

2. **Strong Visual Quality**
   - Use modern layout patterns: hero sections, grids, cards, large typography, buttons.
   - Add clean spacing and alignment using Tailwind utilities.
   - Use color classes (bg-primary, text-accent) throughout.

3. **Multi-Page Simulation**
   - If the prompt mentions multiple pages, create:
       <div id="page-home"> … </div>
       <div id="page-about"> … </div>
       <div id="page-contact"> … </div>
     etc.
   - Show ONE page at a time.
   - Navigation links MUST use:
       event.preventDefault();
       JS must switch visible pages without reloading.

4. **Responsive Navigation + Hamburger Menu**
   - Desktop: horizontal nav
   - Mobile: hamburger menu
   - Add JS to toggle mobile menu open/close
   - Menu must cover all simulated pages

5. **Interactivity Requirements**
   Implement all interactive elements described in the user’s prompt:
   - Contact form validation
   - Sliders / carousels
   - Accordions / FAQs
   - Tabs
   - Cards that expand/show details
   - Counters
   - LocalStorage simulation for storing data (like form inputs)

6. **No Backend**
   - No API routes
   - No server logic
   - No external JS libraries
   - Simulate backend using localStorage only

7. **JavaScript Placement**
   - All JS inside ONE <script> tag at the end of <body>.
   - Use clear, simple vanilla JavaScript.

8. **Output Format**
   - Output ONLY the final HTML file.
   - No explanations, no comments outside code, no markdown.
`
});

const generateWebsitePreviewFlow = ai.defineFlow(
  {
    name: 'generateWebsitePreviewFlow',
    inputSchema: GenerateWebsitePreviewInputSchema,
    outputSchema: GenerateWebsitePreviewOutputSchema,
  },
  async input => {
    const {output} = await generateWebsitePreviewPrompt(input);
    return output!;
  }
);
