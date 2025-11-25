
'use server';

import {generateFullProject, type GenerateFullProjectInput} from '@/ai/flows/generate-full-project';
import type {GenerateFullProjectOutput} from '@/ai/flows/generate-full-project';
import {generateWebsitePreview, type GenerateWebsitePreviewInput} from '@/ai/flows/generate-website-from-prompt';
import type { GenerateWebsitePreviewOutput } from '@/ai/flows/generate-website-from-prompt';
import {smartPromptAssistant} from '@/ai/flows/smart-prompt-assistant';
import {applyLogoAwareTheming} from '@/ai/flows/apply-logo-aware-theming';
import {regenerateWebsiteSection} from '@/ai/flows/regenerate-website-section';
import {brainstormPrompt} from '@/ai/flows/brainstorm-prompt';
import type {BrainstormPromptInput} from '@/ai/flows/brainstorm-prompt';
import JSZip from 'jszip';

export async function generateFullProjectAction(input: GenerateFullProjectInput): Promise<{
  files?: GenerateFullProjectOutput['files'];
  error?: string;
}> {
  console.time('generateFullProjectAction');
  try {
    const result = await generateFullProject(input);
    console.timeEnd('generateFullProjectAction');
    return {files: result.files};
  } catch (e: any) {
    console.error(e);
    console.timeEnd('generateFullProjectAction');
    return {error: e.message || 'An unknown error occurred.'};
  }
}

export async function generateWebsitePreviewAction(
  input: GenerateWebsitePreviewInput
): Promise<{preview?: GenerateWebsitePreviewOutput; error?: string}> {
  console.time('generateWebsitePreviewAction');
  try {
    const rawResult: any = await generateWebsitePreview(input);

    let jsonString = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    
    // Clean the string: remove markdown, and un-escape characters
    jsonString = jsonString
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .replace(/\\n/g, "\\n")
      .replace(/\\"/g, '\\"');
      
    // Find the start and end of the outermost JSON object
    const startIndex = jsonString.indexOf('{');
    const endIndex = jsonString.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Could not find a valid JSON object in the AI's response.");
    }
    jsonString = jsonString.substring(startIndex, endIndex + 1);


    const result = JSON.parse(jsonString);

    console.timeEnd('generateWebsitePreviewAction');
    return {preview: result};
  } catch (e: any)
    {
    console.error("Error in generateWebsitePreviewAction:", e);
    console.timeEnd('generateWebsitePreviewAction');
    return {error: e.message || 'An unknown error occurred while generating the preview.'};
  }
}

export async function downloadFullProjectAction(
  files: GenerateFullProjectOutput['files']
): Promise<{zip?: string; error?: string}> {
  console.time('downloadFullProjectAction');
  try {
    const zip = new JSZip();

    files.forEach(file => {
      // For image files, we need to decode the base64 string from the data URI
      if (file.path.endsWith('.png') || file.path.endsWith('.jpg') || file.path.endsWith('.jpeg') || file.path.endsWith('.gif')) {
        const base64Data = file.content.split(';base64,').pop();
        if (base64Data) {
          zip.file(file.path, base64Data, { base64: true });
        }
      } else {
        zip.file(file.path, file.content);
      }
    });

    const zipBuffer = await zip.generateAsync({type: 'nodebuffer'});
    console.timeEnd('downloadFullProjectAction');
    return {
      zip: zipBuffer.toString('base64'),
    };
  } catch (e: any) {
    console.error(e);
    console.timeEnd('downloadFullProjectAction');
    return {error: e.message || 'An unknown error occurred.'};
  }
}

export async function refinePromptAction(prompt: string) {
  console.time('refinePromptAction');
  try {
    const result = await smartPromptAssistant({websitePrompt: prompt});
    console.timeEnd('refinePromptAction');
    return {refinedPrompt: result.refinedPrompt, questions: result.questionsToConsider};
  } catch (e: any) {
    console.error(e);
    console.timeEnd('refinePromptAction');
    return {error: e.message || 'An unknown error occurred.'};
  }
}

export async function brainstormPromptAction(input: BrainstormPromptInput) {
    console.time('brainstormPromptAction');
    try {
        const result = await brainstormPrompt(input);
        console.timeEnd('brainstormPromptAction');
        return { brainstormedPrompt: result.brainstormedPrompt };
    } catch (e: any) {
        console.error(e);
        console.timeEnd('brainstormPromptAction');
        return { error: e.message || 'An unknown error occurred.' };
    }
}


export async function applyThemingAction(logoDataUri: string) {
  console.time('applyThemingAction');
  try {
    const result = await applyLogoAwareTheming({logoDataUri});
    console.timeEnd('applyThemingAction');
    return {colors: result};
  } catch (e: any) {
    console.error(e);
    console.timeEnd('applyThemingAction');
    return {error: e.message || 'An unknown error occurred.'};
  }
}

export async function regenerateSectionAction(
  websiteContent: string,
  instructions: string
) {
  console.time('regenerateSectionAction');
  try {
    const result = await regenerateWebsiteSection({
      websiteContent,
      instructions,
    });
    console.timeEnd('regenerateSectionAction');
    return {content: result.updatedWebsiteContent};
  } catch (e: any) {
    console.error(e);
    console.timeEnd('regenerateSectionAction');
    return {error: e.message || 'An unknown error occurred.'};
  }
}
