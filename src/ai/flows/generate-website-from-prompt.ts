'use server';
/**
 * Rebuilt and hardened generate-website-from-prompt flow.
 * - Enforces multi-file JSON manifest
 * - Instructs model NOT to escape newlines
 * - Post-processes returned file contents to unescape sequences
 * - Ensures logoDataUri is included as assets/logo.png when provided
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateWebsitePreviewInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the desired website.'),
  logoDataUri: z.optional(z.string()).describe('Optional: A data URI of a logo to be included and used for theming.'),
  theme: z.optional(
    z.object({
      primaryColor: z.string(),
      secondaryColor: z.string(),
      accentColor: z.string(),
    })
  ).describe('Optional: A color theme to apply to the website.'),
});
export type GenerateWebsitePreviewInput = z.infer<typeof GenerateWebsitePreviewInputSchema>;

const GenerateWebsitePreviewOutputSchema = z.object({
  projectName: z.string().describe('The name of the generated project.'),
  entry: z.string().describe('The entry point file, typically index.html.'),
  files: z
    .array(
      z.object({
        path: z.string().describe('The path of the file.'),
        content: z.string().describe('The content of the file.'),
      })
    )
    .describe('An array of file objects representing the project.'),
});
export type GenerateWebsitePreviewOutput = z.infer<typeof GenerateWebsitePreviewOutputSchema>;

/**
 * Helper to unescape common JSON-escaped sequences that the model may produce.
 * Converts literal "\n" sequences into actual newlines, unescapes quotes/backslashes.
 */
function unescapeModelContent(raw: string): string {
  if (!raw) return raw;
  // First, handle double-escaped sequences
  let s = raw;
  // Replace double-escaped newline sequences first (\\n -> \n)
  s = s.replace(/\\\\n/g, '\n');
  // Then single-escaped newlines (\n -> newline)
  s = s.replace(/\\n/g, '\n');
  // Unescape escaped quotes \" -> "
  s = s.replace(/\\"/g, '"');
  // Replace double-escaped backslashes \\ -> \
  s = s.replace(/\\\\/g, '\\');
  // Trim possible surrounding quotes (if model wrapped file content in quotes accidentally)
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s;
}

/**
 * Strong model prompt that instructs multi-file JSON manifest output and forbids escaping newlines.
 */
const generateWebsitePreviewPrompt = ai.definePrompt({
  name: 'generateWebsitePreviewPrompt_v2',
  input: { schema: GenerateWebsitePreviewInputSchema },
  output: { schema: GenerateWebsitePreviewOutputSchema },
  prompt: `You are an expert frontend-focused full-stack developer. Your ONLY task is to output a single JSON object (no explanation) that is a multi-file website project manifest. 

USER PROMPT:
{{{prompt}}}

REQUIREMENTS (READ CAREFULLY):
1) Output EXACTLY ONE JSON object and NOTHING ELSE. No commentary.
2) JSON schema must be:
{
  "projectName":"string",
  "entry":"index.html",
  "files":[
    {"path":"index.html","content":"..."},
    {"path":"pages/home.html","content":"..."},
    {"path":"assets/styles.css","content":"..."},
    {"path":"assets/app.js","content":"..."},
    ...
  ]
}
3) DO NOT escape newlines inside "content". Each file's "content" must be raw text (with real newlines), not JSON-encoded text with "\n" sequences.
4) If you are coding JS, provide raw JS content (no <script> tags in assets/app.js). HTML pages may include references like <script src="assets/app.js"></script> and <link href="assets/styles.css" rel="stylesheet">.
5) Create separate, full HTML pages for pages/home.html, pages/products.html, pages/about.html, pages/contact.html, pages/login.html, pages/cart.html (or equivalents for the website type requested).
6) Provide a fully functional index.html (full document including head) that loads the assets and bootstraps the preview. index.html should not contain all page content — pages/ files should contain page content.
7) Write assets/styles.css and assets/app.js with vanilla JS that uses localStorage to simulate backend (users, cart, orders). Add responsive hamburger menu and routing via hash or history API.
8) Use placeholder images from https://picsum.photos/seed/<seed>/800/600. Provide multiple seeds.
9) If logoDataUri is provided, include a file: assets/logo.png (data URI) and use it in the header.
10) Use modern, realistic text (not lorem ipsum) and fill missing details with reasonable assumptions.
11) DO NOT mention "GenWebAI" or expose any generation UI in the output.
12) IMPORTANT: If you cannot obey any rule, return an empty JSON object {}.

Return only the single JSON manifest object.`,
});

/**
 * Flow: call the model prompt, parse output, unescape file contents just in case, and return.
 */
const generateWebsitePreviewFlow = ai.defineFlow(
  {
    name: 'generateWebsitePreviewFlow_v2',
    inputSchema: GenerateWebsitePreviewInputSchema,
    outputSchema: GenerateWebsitePreviewOutputSchema,
  },
  async (input) => {
    // Call model
    const { output } = await generateWebsitePreviewPrompt(input);

    if (!output) {
      throw new Error('Model produced no output');
    }

    // Post-process file contents to remove escape artifacts
    const cleanedFiles = (output.files || []).map((f: { path: string; content: string }) => {
      return {
        path: f.path,
        content: unescapeModelContent(f.content ?? ''),
      };
    });

    // If logoDataUri provided, ensure it's present as assets/logo.png (already likely included by model).
    if (input.logoDataUri) {
      const hasLogo = cleanedFiles.some((f) => f.path === 'assets/logo.png');
      if (!hasLogo) {
        cleanedFiles.push({
          path: 'assets/logo.png',
          content: input.logoDataUri,
        });
      }
    }

    const result = {
      projectName: output.projectName || 'generated-project',
      entry: output.entry || 'index.html',
      files: cleanedFiles,
    };

    // Validate slightly
    if (!result.files || result.files.length === 0) {
      throw new Error('No files generated by model');
    }

    return result;
  }
);

export async function generateWebsitePreview(input: GenerateWebsitePreviewInput): Promise<GenerateWebsitePreviewOutput> {
  return generateWebsitePreviewFlow(input);
}
