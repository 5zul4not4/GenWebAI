
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating an interactive, multi-file website preview from a user prompt.
 *
 * This flow is designed to create a JSON manifest containing all the files for a complete
 * static website (HTML, CSS, JS). This allows for a high-fidelity, sandboxed preview.
 *
 * It exports:
 *   - generateWebsitePreview - The main function to trigger the website preview generation flow.
 *   - GenerateWebsitePreviewInput - The input type for the function.
 *   - GenerateWebsitePreviewOutput - The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const FileObjectSchema = z.object({
  path: z.string().describe('The full path of the file, e.g., "index.html" or "css/style.css".'),
  content: z.string().describe('The complete content of the file.'),
});

const GenerateWebsitePreviewInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the desired website.'),
  logoDataUri: z.optional(z.string()).describe('Optional: A data URI of a logo to be included and used for theming.'),
});
export type GenerateWebsitePreviewInput = z.infer<typeof GenerateWebsitePreviewInputSchema>;

const GenerateWebsitePreviewOutputSchema = z.object({
  projectName: z.string().describe("The name of the generated project."),
  entry: z.string().describe("The entry point file, almost always 'index.html'."),
  files: z
    .array(FileObjectSchema)
    .describe('An array of file objects representing the entire project structure.'),
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
  prompt: `You are an expert full-stack developer specializing in creating static websites with vanilla HTML, CSS, and JavaScript.
Your task is to generate a complete, interactive, multi-file static website based on the user's prompt. The entire project must be returned as a single JSON object that strictly follows the output schema.

User Prompt: {{{prompt}}}

==========================
ABSOLUTE & STRICT RULES
==========================

1.  **JSON Manifest Output:** You MUST output a single, valid JSON object. This JSON object represents the entire website project. It must have 'projectName', 'entry', and 'files' properties. The 'entry' must be 'index.html'.

2.  **File Structure:** The "files" array must contain objects with "path" and "content" for each file in the project.
    *   Create a logical file structure. For example:
        - \`index.html\` (The main entry file)
        - \`about.html\`, \`contact.html\` (for other pages)
        - \`css/style.css\` (for all CSS)
        - \`js/main.js\` (for all JavaScript)
    *   Do NOT create directories, just flat file paths like 'css/style.css'.

3.  **Technology Stack:**
    *   Use ONLY vanilla HTML, CSS, and JavaScript.
    *   Do NOT use any frameworks (React, Vue, etc.) or server-side languages.
    *   Use Tailwind CSS via the official CDN script in the <head> of each HTML file.
    *   All links between pages and to assets MUST be relative paths (e.g., \`<a href="./about.html">\`, \`<link href="./css/style.css">\`). Use './' for paths. Do NOT use root-relative paths like '/about.html'.

4.  **JavaScript for Interactivity:**
    *   Place all JavaScript in a separate \`js/main.js\` file.
    *   Implement interactive features requested in the prompt (e.g., mobile hamburger menu, form validation).
    *   For forms (e.g., contact form), prevent the default submission and show a success message. Do NOT make real network requests.

5.  **High-Quality UI:**
    *   The generated UI must be modern, aesthetically pleasing, and visually appealing.
    *   Use relevant placeholder images from \`https://picsum.photos/seed/UNIQUE_SEED/800/600\`. Use a different random integer seed for each image.
    *   Content must be substantial and directly related to the user's prompt. Do not use lorem ipsum.

6.  **Logo Handling (IF PROVIDED):**
    {{#if logoDataUri}}
    *   **CRITICAL:** You MUST save the provided logo as a file named \`logo.png\` at the root of the project files. The logo is a data URI; you must decode the Base64 content for the 'content' field of the file object.
    *   In the header of each HTML file, include an \`<img>\` tag that references this logo: \`<img src="./logo.png" alt="Logo" class="h-8 w-auto" />\`.
    {{else}}
    *   If no logo is provided, use a simple text-based logo (e.g., inside a \`<span>\`).
    {{/if}}

7.  **CRITICAL NEGATIVE CONSTRAINT:** You MUST NOT generate any code that replicates the GenWebAI application UI. The preview must be a completely separate website based *only* on the user's prompt.

8.  **Output Format:** Your final response MUST be ONLY the valid JSON object. Do NOT include any explanations, markdown formatting (like \`\`\`json\`), or comments before or after the JSON object.
`,
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
