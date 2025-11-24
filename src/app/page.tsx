'use client';

import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  generateFullProjectAction,
  generateWebsitePreviewAction,
  refinePromptAction,
  regenerateSectionAction,
  downloadFullProjectAction,
  brainstormPromptAction,
} from '@/app/actions';
import type { GenerateFullProjectOutput } from '@/ai/flows/generate-full-project';
import type { GenerateWebsitePreviewOutput } from '@/ai/flows/generate-website-from-prompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  MonitorPlay,
  Download,
  History,
  LoaderCircle,
  RefreshCw,
  WandSparkles,
} from 'lucide-react';
import AppHeader from '@/components/header';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AuthButton } from '@/components/auth-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { currentModel } from '@/ai/model';

// Helper types
type ProjectFile = { path: string; content: string };
type Project = {
  id: string;
  name: string;
  prompt: string;
  userId: string;
  createdAt: any;
  files: GenerateFullProjectOutput['files'];
  previewFiles: GenerateWebsitePreviewOutput['files'];
  previewEntry: string;
};

// Demo project placeholder (keeps your current demo behavior)
const demoProject = {/* keep same as your existing demoProject or load minimal sample */};

function unescapeModelContent(raw: string) {
  if (!raw) return raw;
  let s = raw;
  s = s.replace(/\\\\n/g, '\n');
  s = s.replace(/\\n/g, '\n');
  s = s.replace(/\\"/g, '"');
  s = s.replace(/\\\\/g, '\\');
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}

/**
 * Build a srcDoc for iframe from generated files.
 * This does:
 * - unescape contents
 * - create blob URLs for assets (.css, .js, images)
 * - replace href/src that reference generated paths with blob urls
 * - inject a small script that monkey-patches fetch() inside the iframe to serve virtual files,
 *   and also intercepts link clicks to load internal pages without navigation.
 */
const getPreviewSrcDoc = (files: ProjectFile[], entryFile: string) => {
  if (!files || files.length === 0) return '<html><body>No files</body></html>';

  // Clean file contents
  const cleanedFiles = files.map((f) => ({
    path: f.path,
    content: unescapeModelContent(f.content || ''),
  }));

  // Create a map for blob URLs for assets (css, js, images) and for HTML pages
  const blobMap: Record<string, string> = {};
  cleanedFiles.forEach((file) => {
    const path = file.path;
    let contentType = 'text/plain';
    if (path.endsWith('.html')) contentType = 'text/html';
    else if (path.endsWith('.css')) contentType = 'text/css';
    else if (path.endsWith('.js')) contentType = 'application/javascript';
    else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(path)) {
      // If asset is a data URI (logo), put it directly as blob URL from data
      if (file.content.startsWith('data:')) {
        // Convert data URI into blob
        const parts = file.content.split(',');
        const meta = parts[0];
        const base64 = parts[1];
        try {
          const binary = atob(base64);
          const len = binary.length;
          const u8 = new Uint8Array(len);
          for (let i = 0; i < len; ++i) u8[i] = binary.charCodeAt(i);
          const blob = new Blob([u8], { type: meta.split(':')[1].split(';')[0] });
          blobMap[path] = URL.createObjectURL(blob);
          return;
        } catch (e) {
          // fallback to storing data URI directly
          blobMap[path] = file.content;
          return;
        }
      } else {
        // Non-data images may be external URLs already (picsum etc). We'll set as-is if content looks like URL.
        if (file.content.startsWith('http')) {
          blobMap[path] = file.content;
          return;
        }
        // If content is binary base64, we could decode; for simplicity, treat as text URL fallback.
        blobMap[path] = file.content;
        return;
      }
    }

    // Create blob for text assets (html/css/js)
    const blob = new Blob([file.content], { type: contentType });
    blobMap[path] = URL.createObjectURL(blob);
  });

  // Find entry content cleaned and then replace local references in it to blob URLs
  const entryFileObj = cleanedFiles.find((f) => f.path === entryFile) || cleanedFiles[0];
  let finalHtml = entryFileObj.content || '<html><body>Missing entry</body></html>';

  // Replace occurrences of src/href referencing project paths to blobMap URLs
  // This handles quotes and no-quote references conservatively.
  Object.keys(blobMap).forEach((p) => {
    // escape for regex
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace matches like src="assets/app.js" or src='/assets/app.js'
    finalHtml = finalHtml.replace(new RegExp(`(src|href)=['"](?:\\.\\/|\\/)??${esc}['"]`, 'g'), (m) => {
      const attr = m.split('=')[0];
      return `${attr}="${blobMap[p]}"`;
    });
    // Also replace bare occurrences (like fetch('pages/home.html')) inside <script> tags is harder;
    // We'll provide a virtual file map inside injected script instead (below) for fetch interception.
  });

  // Build a JSON object of virtual files for fetch interception inside iframe.
  const virtualFilesObj: Record<string, string> = {};
  cleanedFiles.forEach((f) => {
    // Keep content raw but safe for embedding in a <script> as JSON string
    virtualFilesObj[`/${f.path}`] = f.content;
  });
  const virtualFilesJson = JSON.stringify(virtualFilesObj);

  // Inject script to intercept fetch and anchor clicks to serve virtual files from the map,
  // and to ensure CSS/JS loaded via blob urls still work.
  const injectionScript = `
<script>
(function(){
  // Create virtual files map
  const VFILES = ${virtualFilesJson};

  // Monkey patch fetch inside iframe so requests to /<path> will return VFILES content
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(resource, options) {
    try {
      const u = new URL(resource.toString(), window.location.href);
      const pathname = u.pathname;
      if (VFILES[pathname]) {
        const content = VFILES[pathname];
        // Determine content type by extension
        let ct = 'text/plain';
        if (pathname.endsWith('.html')) ct = 'text/html';
        else if (pathname.endsWith('.css')) ct = 'text/css';
        else if (pathname.endsWith('.js')) ct = 'application/javascript';
        else if (pathname.match(/\\.(png|jpg|jpeg|gif|svg)$/i)) ct = 'image/*';
        const blob = new Blob([content], { type: ct });
        const resp = new Response(blob, { status: 200, headers: { 'Content-Type': ct }});
        return Promise.resolve(resp);
      }
    } catch (e) {
      // ignore and fallback to original fetch
    }
    return originalFetch(resource, options);
  };

  // SPA-style internal navigation: intercept anchor clicks and load HTML into #app-root if present
  document.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) {
      // let hash navigation handle it
      return;
    }
    // If the link points to a virtual file path, intercept
    try {
      const u = new URL(href, window.location.href);
      if (VFILES[u.pathname]) {
        e.preventDefault();
        // Update browser history
        history.pushState({path: u.pathname}, '', '#'+u.pathname.replace('/pages',''));
        // Load file into #app-root if it exists
        const root = document.getElementById('app-root') || document.body;
        fetch(u.pathname).then(r => r.text()).then(txt => {
          // If HTML document, just set innerHTML of root
          root.innerHTML = txt;
          // If the app included scripts that rely on DOMContentLoaded, we can eval inline scripts:
          // Execute inline scripts from loaded content
          const scripts = root.querySelectorAll('script');
          scripts.forEach(s => {
            if (s.src) {
              const scr = document.createElement('script');
              scr.src = s.src;
              document.body.appendChild(scr);
            } else {
              try { eval(s.innerText); } catch(e){ console.error(e); }
            }
          });
        });
      }
    } catch(e) {}
  });

  // Handle back/forward navigation loading
  window.addEventListener('popstate', function(e){
    const path = (e.state && e.state.path) || '/';
    if (VFILES[path]) {
      fetch(path).then(r => r.text()).then(txt => {
        const root = document.getElementById('app-root') || document.body;
        root.innerHTML = txt;
      });
    }
  });

  // On initial load, if URL has hash like #/about, load corresponding /pages/about.html
  function initialHashLoad() {
    const hash = window.location.hash || '#/';
    const path = (hash === '#/' ? '/' : hash.substring(1));
    const candidate = path === '/' ? '/pages/home.html' : '/pages' + path + '.html';
    if (VFILES[candidate]) {
      fetch(candidate).then(r => r.text()).then(txt => {
        const root = document.getElementById('app-root') || document.body;
        root.innerHTML = txt;
        // execute inline scripts inside loaded content
        const scripts = root.querySelectorAll('script');
        scripts.forEach(s => {
          if (s.src) {
            const scr = document.createElement('script');
            scr.src = s.src;
            document.body.appendChild(scr);
          } else {
            try { eval(s.innerText); } catch(e){ console.error(e); }
          }
        });
      });
    }
  }

  // Kick things off after DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialHashLoad);
  } else {
    initialHashLoad();
  }
})();
</script>
`;

  // Ensure finalHtml contains a <base> tag pointing to entry file's blob so relative references in HTML behave
  const entryBlobUrl = blobMap[entryFile] || '';
  if (finalHtml.indexOf('<head') !== -1) {
    finalHtml = finalHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${entryBlobUrl}">`);
  } else {
    finalHtml = `<head><base href="${entryBlobUrl}"></head>\n` + finalHtml;
  }

  // Append injectionScript before closing body
  if (finalHtml.includes('</body>')) {
    finalHtml = finalHtml.replace('</body>', `${injectionScript}</body>`);
  } else {
    finalHtml = finalHtml + injectionScript;
  }

  return finalHtml;
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [websiteName, setWebsiteName] = useState('');
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [websiteContent, setWebsiteContent] = useState(''); // srcDoc for iframe
  const [previewFiles, setPreviewFiles] = useState<ProjectFile[]>([]);
  const [previewEntry, setPreviewEntry] = useState('index.html');
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [generatedFiles, setGeneratedFiles] = useState<GenerateFullProjectOutput['files']>([]);
  const [loading, setLoading] = useState({
    generate: false,
    download: false,
    brainstorm: false,
    refine: false,
  });

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    // Load demo content similar to your previous behavior
    if (demoProject && demoProject.preview) {
      const { files, entry } = demoProject.preview;
      const srcDoc = getPreviewSrcDoc(files as ProjectFile[], entry);
      setWebsiteContent(srcDoc);
      setPreviewFiles(files as ProjectFile[]);
      setPreviewEntry(entry);
      setWebsiteName(demoProject.name || 'Demo');
      setPrompt(demoProject.prompt || '');
      setGeneratedFiles(demoProject.fullProject?.files || []);
      toast({ title: 'Demo Loaded', description: 'Pre-generated demo project loaded.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Action handlers (generate)
  const handleGenerate = async () => {
    if (!prompt) {
      toast({ title: 'Please enter a prompt', variant: 'destructive' });
      return;
    }
    setLoading((s) => ({ ...s, generate: true }));

    const previewResult = await generateWebsitePreviewAction({ prompt, logoDataUri: logoDataUri ?? undefined });
    if (previewResult.error || !previewResult.preview) {
      toast({ title: 'Preview generation failed', description: previewResult.error || 'No preview produced', variant: 'destructive' });
      setLoading((s) => ({ ...s, generate: false }));
      return;
    }

    // Clean file contents on client as well (defense-in-depth)
    const files = (previewResult.preview.files || []).map((f: any) => ({
      path: f.path,
      content: unescapeModelContent(f.content || ''),
    }));
    const entry = previewResult.preview.entry || 'index.html';
    const srcDoc = getPreviewSrcDoc(files, entry);
    setWebsiteContent(srcDoc);
    setPreviewFiles(files);
    setPreviewEntry(entry);

    toast({ title: 'Preview ready', description: 'Interactive preview generated.' });

    // Generate full project (optional)
    const projectResult = await generateFullProjectAction({ prompt, logoDataUri: logoDataUri ?? undefined });
    if (!projectResult.error && projectResult.files) {
      setGeneratedFiles(projectResult.files);
      // Save to localStorage as a quick persist
      localStorage.setItem('generated_files', JSON.stringify(projectResult.files));
    }

    setLoading((s) => ({ ...s, generate: false }));
  };

  const handleDownloadFullProject = async () => {
    if (!generatedFiles || generatedFiles.length === 0) {
      toast({ title: 'No project generated', variant: 'destructive' });
      return;
    }
    setLoading((s) => ({ ...s, download: true }));
    const result = await downloadFullProjectAction(generatedFiles);
    if (result.error) {
      toast({ title: 'Download failed', description: result.error, variant: 'destructive' });
    } else if (result.zip) {
      const blob = new Blob([Buffer.from(result.zip, 'base64')], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(websiteName || 'website').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Download started' });
    }
    setLoading((s) => ({ ...s, download: false }));
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUri(reader.result as string);
      toast({ title: 'Logo loaded' });
    };
    reader.onerror = () => {
      toast({ title: 'Failed to read logo', variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  };

  if (isUserLoading) {
    return <div className="flex items-center justify-center h-screen"><LoaderCircle className="animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <AppHeader websiteName={websiteName || 'Preview'}>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPreviewKey(Date.now())}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button size="sm" onClick={handleDownloadFullProject} disabled={loading.download || generatedFiles.length === 0}>
            {loading.download ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download
          </Button>
          <AuthButton />
          <ThemeToggle />
        </div>
      </AppHeader>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <Card className="lg:col-span-1 flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><WandSparkles /> Prompt</CardTitle>
            <CardDescription>Describe the website you want to generate.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="h-64" />
            <div className="mt-2">
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleGenerate} disabled={loading.generate}>{loading.generate ? 'Generating...' : 'Generate Preview'}</Button>
              <Button variant="outline" onClick={() => { setPrompt(''); setWebsiteName(''); setPreviewFiles([]); setWebsiteContent(''); }}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MonitorPlay /> Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <iframe
              key={previewKey}
              srcDoc={websiteContent}
              className="w-full h-[calc(100vh-5.5rem)] border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Website Preview"
            />
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-2 right-2 text-xs bg-background/60 p-2 rounded shadow">
        Using model: {currentModel}
      </div>
    </div>
  );
}
