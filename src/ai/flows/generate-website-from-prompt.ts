
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
  prompt: `You are an expert full-stack frontend developer. 
Your ONLY task is to generate a COMPLETE, REALISTIC, MULTI-FILE website project that SIMULATES a full-stack application entirely in the browser.

==============================
USER REQUIREMENT
==============================
{{{prompt}}}

{{#if logoDataUri}}
A logo was provided. Use it as /assets/logo.png (data URI).
{{/if}}

==============================
ABSOLUTE RULES
==============================

1) MULTI-FILE OUTPUT (MANDATORY)
--------------------------------
You MUST output a JSON object with this schema:

{
  "projectName": "string",
  "entry": "index.html",
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "pages/about.html", "content": "..." },
    { "path": "assets/styles.css", "content": "..." },
    { "path": "assets/app.js", "content": "..." }
  ]
}

• \`path\` = real folder structure  
• \`content\` = raw text of the file  
• **No markdown**, no explanation, no commentary  
• **Only one JSON object**  

2) PRODUCE REAL PAGES — NOT SECTIONS
------------------------------------
You MUST create **multiple standalone HTML pages**:
Example (depending on user prompt):

- index.html  
- pages/home.html  
- pages/about.html  
- pages/products.html  
- pages/product.html  
- pages/cart.html  
- pages/checkout.html  
- pages/orders.html  
- pages/profile.html  
- pages/login.html  
- pages/signup.html  

Each page must be a FULL HTML document including:
- <head> with CSS link  
- Navbar  
- Footer  
- <script src="assets/app.js"></script>  

3) CSS & JS SEPARATION
----------------------
• All styling goes to:  assets/styles.css  
• All logic goes to:    assets/app.js  
• You may use Tailwind CDN in HTML head if needed.  
• NO external JS libraries allowed (no jQuery, no React, no Vue).  
• You MUST write **vanilla JavaScript** only.

4) FULL-STACK SIMULATION USING localStorage
-------------------------------------------
Simulate server logic using \`localStorage\`:
✔ User accounts  
✔ Login / Signup  
✔ Sessions  
✔ Orders  
✔ Wishlist tracking  
✔ Ratings  
✔ Cart  
✔ Checkout steps  
✔ Product DB seeding  

Example:
- On first load: seed sample products into localStorage  
- signup: save user → localStorage  
- login: verify user → localStorage  
- add to cart: stored in localStorage  
- place order: save order record → localStorage  

NO real backend.  
NO fetch.  
NO external APIs.

5) ALWAYS FILL COMPLETE CONTENT
-------------------------------
Even if the user prompt is vague or incorrect:

Example:
User prompt: “make e commerce”
→ MUST generate a full e-commerce simulation:
- Home hero banner  
- Product catalog  
- Categories  
- Cart page  
- Checkout steps  
- Track orders  
- User profile  
- Wishlist  
- Login/Signup  
- Responsive navbar  
- Product pages with multiple images  

Use REALISTIC content (not lorem).  

6) IMAGES (REQUIRED)
--------------------
Use any public images:
• https://picsum.photos  
• https://source.unsplash.com

Examples:
https://picsum.photos/seed/prod1/800/600  
https://source.unsplash.com/random/800x600/?shoes

7) LOGO (IF PROVIDED)
---------------------
If logoDataUri exists:
→ Create file: assets/logo.png  
→ content = the data URI  

Header must display:
<img src="/assets/logo.png" class="h-10 w-auto"/>

8) RESPONSIVE DESIGN
---------------------
All pages MUST be fully responsive.  
Must include:
• hamburger menu  
• collapsible nav  
• mobile-friendly layout  

9) PROHIBITED CONTENT
----------------------
You MUST NOT generate:
- Single HTML files  
- SPA-style hidden sections  
- Anything referencing “GenWebAI”  
- Comments explaining your output  
- Markdown fences  
- External JS libraries  

10) OUTPUT FORMAT (CRITICAL)
-----------------------------
The final output must be ONLY:

A RAW JSON OBJECT EXACTLY MATCHING:
{
  "projectName": "...",
  "entry": "index.html",
  "files": [ ... ]
}

NO markdown.  
NO backticks.  
NO prose.  
NO commentary.  
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
