
"use client";

import { useState, useRef, ChangeEvent, FormEvent, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  applyThemingAction,
  generateFullProjectAction,
  generateWebsitePreviewAction,
  refinePromptAction,
  regenerateSectionAction,
  downloadFullProjectAction,
  brainstormPromptAction,
} from '@/app/actions';
import type { GenerateFullProjectOutput } from '@/ai/flows/generate-full-project';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Code2,
  Download,
  History,
  Lightbulb,
  LoaderCircle,
  MonitorPlay,
  Palette,
  RefreshCw,
  Replace,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AuthButton } from '@/components/auth-button';
import { ThemeToggle } from '@/components/theme-toggle';


type LoadingStates = {
  generate: boolean;
  refine: boolean;
  theme: boolean;
  regenerate: boolean;
  download: boolean;
  brainstorm: boolean;
};

type Project = {
    id: string; // Firestore document ID
    name: string;
    prompt: string;
    userId: string;
    createdAt: any; // Firestore timestamp
    files: GenerateFullProjectOutput['files'];
    previewContent: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [websiteName, setWebsiteName] = useState('');
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [websiteContent, setWebsiteContent] = useState('');
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [isBrainstormDialogOpen, setIsBrainstormDialogOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [generatedFiles, setGeneratedFiles] = useState<GenerateFullProjectOutput['files']>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);


  const [loading, setLoading] = useState<LoadingStates>({
    generate: false,
    refine: false,
    theme: false,
    regenerate: false,
    download: false,
    brainstorm: false,
  });
  
  const { toast } = useToast();
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();


  useEffect(() => {
    // Only check for user after initial loading is complete
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
  const projectsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'projects');
  }, [firestore, user]);

  const { data: history, isLoading: isHistoryLoading } = useCollection<Project>(projectsCollection);

  const saveToHistory = async (projectData: Omit<Project, 'id' | 'userId' | 'createdAt'>): Promise<string | undefined> => {
    if (!projectsCollection || !user) return;
    try {
      const docRef = await addDoc(projectsCollection, {
        ...projectData,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e: any) {
        console.error("Failed to save project to firestore", e);
        toast({
            title: "Failed to Save History",
            description: e.message || "Could not save project to your history.",
            variant: "destructive",
        })
    }
  };
  
  const loadFromHistory = (project: Project) => {
    setWebsiteName(project.name);
    setPrompt(project.prompt);
    setGeneratedFiles(project.files);
    setWebsiteContent(project.previewContent);
    setCurrentProjectId(project.id);
    storeFilesForIDE(project.files, project.name);
    toast({ title: "Project Loaded", description: `Loaded "${project.name}" from history.` });
    setIsHistoryOpen(false); // Close the history sheet
  };

  const deleteFromHistory = async (projectId: string) => {
    if (!firestore || !user) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'projects', projectId));
      toast({ title: "Project Deleted", description: "The project has been removed from your history." });
    } catch (e: any) {
        console.error("Failed to delete project from firestore", e);
        toast({
            title: "Failed to Delete History",
            description: e.message || "Could not delete project from your history.",
            variant: "destructive",
        })
    }
  };


  const handleGenerate = async () => {
    if (!prompt) {
      toast({ title: 'Prompt is empty', description: 'Please enter a description for your website.', variant: 'destructive' });
      return;
    }
    setLoading(prev => ({ ...prev, generate: true }));
    setWebsiteContent('');
    setGeneratedFiles([]);
    setCurrentProjectId(null);
    
    const currentWebsiteName = websiteName || 'Untitled Project';

    let theme = undefined;
    if (logoDataUri) {
        setLoading(prev => ({...prev, theme: true}));
        toast({ title: 'Applying Theme...', description: 'Extracting colors from your logo.' });
        const themeResult = await applyThemingAction(logoDataUri);
        setLoading(prev => ({...prev, theme: false}));
        if (themeResult.error || !themeResult.colors) {
            toast({ title: 'Theming Failed', description: themeResult.error || 'Could not extract colors.', variant: 'destructive' });
        } else {
            theme = themeResult.colors;
        }
    }

    const previewResult = await generateWebsitePreviewAction({ prompt, logoDataUri: logoDataUri ?? undefined, theme });

    if (previewResult.error) {
      toast({ title: 'Preview Generation Failed', description: previewResult.error, variant: 'destructive' });
      setLoading(prev => ({ ...prev, generate: false }));
      return;
    }

    if (previewResult.previewContent) {
      setWebsiteContent(previewResult.previewContent);
      toast({ title: 'Preview Generated!', description: 'Your interactive preview is ready. Now generating full project...' });
    }

    const projectResult = await generateFullProjectAction({ prompt, logoDataUri: logoDataUri ?? undefined, theme });

    if (projectResult.error) {
      toast({ title: 'Full Project Generation Failed', description: projectResult.error, variant: 'destructive' });
    } else if (projectResult.files && previewResult.previewContent) {
        setGeneratedFiles(projectResult.files);
        storeFilesForIDE(projectResult.files, currentWebsiteName);
        const newProjectId = await saveToHistory({
            name: currentWebsiteName,
            prompt: prompt,
            files: projectResult.files,
            previewContent: previewResult.previewContent,
        });
        if (newProjectId) {
          setCurrentProjectId(newProjectId);
        }
      toast({ title: 'Project Generated & Saved!', description: 'The full project is ready and has been saved to your history.' });
    }
    
    setLoading(prev => ({ ...prev, generate: false }));
  };
  
  const handleDownloadFullProject = async () => {
      if (generatedFiles.length === 0) {
          toast({ title: 'No project generated', description: 'Please generate a project first.', variant: 'destructive' });
          return;
      }
      setLoading(prev => ({ ...prev, download: true }));
      const result = await downloadFullProjectAction(generatedFiles);
      if (result.error) {
          toast({ title: 'Download Failed', description: result.error, variant: 'destructive' });
      } else if (result.zip) {
          const blob = new Blob([Buffer.from(result.zip, 'base64')], { type: 'application/zip' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const safeWebsiteName = (websiteName || 'website-project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          a.download = `${safeWebsiteName}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({ title: 'Download Started', description: 'Your project zip file is downloading.' });
      }
      setLoading(prev => ({ ...prev, download: false }));
  }

  const handleRefinePrompt = async () => {
    if (!prompt) {
      toast({ title: 'Prompt is empty', description: 'Please enter a prompt to refine.', variant: 'destructive' });
      return;
    }
    setLoading(prev => ({ ...prev, refine: true }));
    const result = await refinePromptAction(prompt);
    if (result.error) {
      toast({ title: 'Refinement Failed', description: result.error, variant: 'destructive' });
    } else if (result.refinedPrompt) {
      setPrompt(result.refinedPrompt);
      const questions = result.questions || [];
      toast({
        title: 'AI has refined your prompt!',
        description: (
          <div>
            <p className="mb-2">Consider these questions to add even more detail:</p>
            <ul className="list-disc list-inside space-y-1">
              {questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
            </ul>
            <p className="mt-2">Tip: Answer these by editing your prompt, then generate!</p>
          </div>
        ),
        duration: 10000,
      });
    }
    setLoading(prev => ({ ...prev, refine: false }));
  };

  const handleBrainstormPrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = {
      purpose: formData.get('purpose') as string,
      audience: formData.get('audience') as string,
      style: formData.get('style') as string,
      pages: formData.get('pages') as string,
      features: formData.get('features') as string,
    };

    if (Object.values(input).some(val => !val)) {
      toast({ title: 'All fields are required', description: 'Please answer all questions to generate a prompt.', variant: 'destructive' });
      return;
    }

    setLoading(prev => ({ ...prev, brainstorm: true }));
    const result = await brainstormPromptAction(input);
    if (result.error) {
      toast({ title: 'Brainstorm Failed', description: result.error, variant: 'destructive' });
    } else if (result.brainstormedPrompt) {
      setPrompt(result.brainstormedPrompt);
      toast({ title: 'Prompt Generated!', description: 'The AI has generated a detailed prompt from your answers.' });
    }
    setLoading(prev => ({ ...prev, brainstorm: false }));
    setIsBrainstormDialogOpen(false);
  };


  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
        setLogoDataUri(null);
        return;
    };
    
    setLoading(prev => ({ ...prev, theme: true }));
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setLogoDataUri(dataUri);
      toast({ title: 'Logo Ready!', description: `${file.name} is uploaded and will be used for theming upon generation.` });
      setLoading(prev => ({ ...prev, theme: false }));
    };
    reader.onerror = () => {
      toast({ title: 'File Read Error', description: 'Could not read the logo file.', variant: 'destructive' });
      setLoading(prev => ({ ...prev, theme: false }));
    };
  };

  const handleRegenerateSection = async () => {
    if (!regenerateInstructions) {
      toast({ title: 'Missing Information', description: 'Please provide instructions for the changes.', variant: 'destructive' });
      return;
    }
    setLoading(prev => ({...prev, regenerate: true}));
    const result = await regenerateSectionAction(websiteContent, regenerateInstructions);
    if(result.error) {
      toast({ title: 'Regeneration Failed', description: result.error, variant: 'destructive' });
    } else if (result.content) {
      setWebsiteContent(result.content);
      // Update history if a project is loaded
      if (currentProjectId && user && firestore) {
        try {
          const projectRef = doc(firestore, 'users', user.uid, 'projects', currentProjectId);
          await updateDoc(projectRef, {
            previewContent: result.content
          });
          toast({ title: 'Preview Updated & Saved!', description: `Your changes have been saved to the project history.` });

        } catch (e: any) {
          console.error("Failed to update project history", e);
          toast({ title: 'History Update Failed', description: e.message, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Preview Updated', description: `The preview has been updated based on your instructions.` });
      }
    }
    setLoading(prev => ({...prev, regenerate: false}));
    setRegenerateInstructions('');
  }
  
  const storeFilesForIDE = (files: GenerateFullProjectOutput['files'], name: string) => {
    if (typeof window !== 'undefined') {
        if (files.length > 0) {
            localStorage.setItem('generated_files', JSON.stringify(files));
            localStorage.setItem('website_name', name);
        } else {
            localStorage.removeItem('generated_files');
            localStorage.removeItem('website_name');
        }
    }
  }

  const startOver = () => {
    setWebsiteContent('');
    setPrompt('');
    setGeneratedFiles([]);
    setWebsiteName('');
    setLogoDataUri(null);
    setCurrentProjectId(null);
    storeFilesForIDE([], '');
  };
  
  if (isUserLoading || !user) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  if (websiteContent === '' && generatedFiles.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader>
             <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                        <History className="mr-2 h-4 w-4" />
                        History
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Project History</SheetTitle>
                        <SheetDescription>
                            Load or delete your past generated websites.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4 h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                        {isHistoryLoading ? <LoaderCircle className="animate-spin" /> : history && history.length > 0 ? (
                            history.map(session => (
                                <Card key={session.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{session.name}</CardTitle>
                                        <CardDescription>
                                            {session.createdAt ? formatDistanceToNow(new Date(session.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardFooter className="flex justify-between">
                                        <Button size="sm" onClick={() => loadFromHistory(session)}>Load</Button>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="destructive" size="icon" onClick={() => deleteFromHistory(session.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Delete Project</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground p-4 text-center">No projects in your history yet.</p>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
            <AuthButton />
            <ThemeToggle />
        </AppHeader>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader>
              <CardTitle className="font-headline text-3xl flex items-center gap-2">
                <WandSparkles className="w-8 h-8 text-primary" />
                Create Your Website with AI
              </CardTitle>
              <CardDescription>
                Describe the website you want to build. Be as specific as you can, or use the brainstorm/refine buttons to get help.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full gap-2">
                 <Label htmlFor="websiteName">Website Name</Label>
                 <Input
                  id="websiteName"
                  placeholder="e.g., 'My Awesome Site'"
                  value={websiteName}
                  onChange={e => setWebsiteName(e.target.value)}
                />
              </div>
              <div className="grid w-full gap-2">
                <Label htmlFor="prompt">Your Website Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., 'A modern landing page for a SaaS company specializing in project management...'"
                  rows={6}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  className="hidden"
                  accept="image/*"
                />
                <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={loading.theme}>
                  {loading.theme ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  {loading.theme ? "Reading..." : "Upload Logo"}
                </Button>
                {logoDataUri ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoDataUri} alt="Logo Preview" className="h-10 w-10 object-contain rounded-sm border p-1" />
                ) : (
                  <p className="text-sm text-muted-foreground">Optional: Use logo for theming.</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-4">
              <div className="flex gap-2">
                 <Dialog open={isBrainstormDialogOpen} onOpenChange={setIsBrainstormDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" disabled={loading.brainstorm || loading.generate}>
                       <Lightbulb className="mr-2 h-4 w-4" />
                       Brainstorm
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Brainstorm a Detailed Prompt</DialogTitle>
                      <DialogDescription>
                        Answer the questions below, and the AI will synthesize them into a single, powerful prompt for you.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBrainstormPrompt}>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="purpose" className="text-right">Purpose</Label>
                          <Input id="purpose" name="purpose" placeholder="e.g., To sell handmade sourdough bread" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="audience" className="text-right">Audience</Label>
                           <Input id="audience" name="audience" placeholder="e.g., Local families and food enthusiasts" className="col-span-3" />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="style" className="text-right">Visual Style</Label>
                           <Input id="style" name="style" placeholder="e.g., Warm, rustic, and friendly" className="col-span-3" />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="pages" className="text-right">Key Pages</Label>
                           <Input id="pages" name="pages" placeholder="e.g., Home, Our Breads, About Us, Contact" className="col-span-3" />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="features" className="text-right">Features</Label>
                           <Input id="features" name="features" placeholder="e.g., A contact form, an image gallery of breads" className="col-span-3" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={loading.brainstorm}>
                          {loading.brainstorm && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                          Generate Prompt
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" onClick={handleRefinePrompt} disabled={loading.refine || loading.generate}>
                  {loading.refine ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="mr-2 h-4 w-4" />
                  )}
                  {loading.refine ? 'Refining...' : 'Refine with AI'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={loading.generate || loading.refine || loading.brainstorm}>
                  {loading.generate ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {loading.generate ? 'Generating...' : 'Generate Website'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="flex flex-col h-screen bg-muted/40">
       <AppHeader websiteName={websiteName || 'Preview'}>
        <div className="flex items-center gap-2">
           <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                        <History className="mr-2 h-4 w-4" />
                        History
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Project History</SheetTitle>
                        <SheetDescription>
                            Load or delete your past generated websites.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4 h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                         {isHistoryLoading ? <LoaderCircle className="animate-spin" /> : history && history.length > 0 ? (
                            history.map(session => (
                                <Card key={session.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{session.name}</CardTitle>
                                        <CardDescription>
                                           {session.createdAt ? formatDistanceToNow(new Date(session.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardFooter className="flex justify-between">
                                        <Button size="sm" onClick={() => loadFromHistory(session)}>Load</Button>
                                         <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="destructive" size="icon" onClick={() => deleteFromHistory(session.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Delete Project</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground p-4 text-center">No projects in your history yet.</p>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <Button size="sm" variant="outline" onClick={() => setPreviewKey(Date.now())}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Preview
            </Button>

          <Button size="sm" variant="outline" asChild>
            <Link href="/ide_code" prefetch={false}>
              <Code2 className="mr-2 h-4 w-4" />
              View Code
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadFullProject} disabled={loading.download || generatedFiles.length === 0}>
            {loading.download ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {loading.download ? 'Zipping...' : 'Download Project'}
          </Button>
          
          <Button size="sm" onClick={startOver}>
            Start Over
          </Button>
          <AuthButton />
          <ThemeToggle />
        </div>
      </AppHeader>
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 items-start">
        {/* Reference Image Panel */}
        <Card className="lg:col-span-1 flex flex-col h-full max-h-[calc(100vh-5.5rem)]">
           <CardHeader>
              <CardTitle className="font-headline text-lg flex items-center gap-2">
                <Replace /> Regenerate Website
              </CardTitle>
               <CardDescription>
                  Describe the changes you want to see. This will regenerate the interactive preview.
                </CardDescription>
            </CardHeader>
             <CardContent className="flex-1 flex flex-col gap-4">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor="instructions">
                    Instructions
                  </Label>
                  <Textarea
                    id="instructions"
                    value={regenerateInstructions}
                    onChange={(e) => setRegenerateInstructions(e.target.value)}
                    placeholder="e.g., 'Change the headline to...' "
                    className="h-full"
                  />
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleRegenerateSection} disabled={loading.regenerate || !websiteContent || !regenerateInstructions} className="w-full">
                  {loading.regenerate && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Regenerate
                </Button>
            </CardFooter>
        </Card>
        
        {/* Preview Panel */}
        <Card className="lg:col-span-2 flex flex-col h-full max-h-[calc(100vh-5.5rem)]">
            <CardHeader>
            <CardTitle className="font-headline text-lg flex items-center gap-2">
                <MonitorPlay /> Live Preview
            </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
            <iframe
                key={previewKey}
                srcDoc={websiteContent}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Website Preview"
            />
            </CardContent>
        </Card>
      </main>
    </div>
    </TooltipProvider>
  );
}



    