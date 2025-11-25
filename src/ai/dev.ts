'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/apply-logo-aware-theming.ts';
import '@/ai/flows/regenerate-website-section.ts';
import '@/ai/flows/smart-prompt-assistant.ts';
import '@/ai/flows/generate-project-and-preview.ts';
import '@/ai/flows/generate-full-project.ts';
import '@/ai/flows/generate-website-from-prompt.ts';
import '@/ai/flows/brainstorm-prompt.ts';
