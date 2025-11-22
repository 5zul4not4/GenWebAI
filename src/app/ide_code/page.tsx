'use client';

import { useState, useEffect } from 'react';
import AppHeader from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, Home, Download, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { downloadFullProjectAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

type ProjectFile = {
  path: string;
  content: string;
};

export default function CodeIDEPage() {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [websiteName, setWebsiteName] = useState('GenWebAI');
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
        if (typeof window !== 'undefined') {
            const storedFiles = localStorage.getItem('generated_files');
            const storedName = localStorage.getItem('website_name');
            if (storedName) {
                setWebsiteName(storedName);
            }
            if (storedFiles) {
                const parsedFiles = JSON.parse(storedFiles);
                setFiles(parsedFiles);
                if (parsedFiles.length > 0) {
                setSelectedFile(parsedFiles.find((f: ProjectFile) => f.path.endsWith('page.tsx')) || parsedFiles[0]);
                }
            }
        }
    } catch (error) {
      console.error("Failed to load or parse files from localStorage", error);
      toast({
        title: "Error loading files",
        description: "Could not load project files from your browser's storage.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleDownload = async () => {
    if (files.length === 0) {
      toast({ title: 'No files to download', description: 'There are no project files to download.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await downloadFullProjectAction(files);
    if (result.error) {
        toast({ title: 'Download Failed', description: result.error, variant: 'destructive' });
    } else if (result.zip) {
        const blob = new Blob([Buffer.from(result.zip, 'base64')], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeWebsiteName = websiteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeWebsiteName || 'website-project'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Download Started', description: 'Your project zip file is downloading.' });
    }
    setLoading(false);
  }
  
  const renderFileTree = () => {
    // This is a simplified file tree renderer. A real implementation
    // would likely use a recursive function to build a nested structure.
    return files.map((file) => (
       <Button
        key={file.path}
        variant={selectedFile?.path === file.path ? 'secondary' : 'ghost'}
        className="w-full justify-start h-8 px-2"
        onClick={() => setSelectedFile(file)}
      >
        <FileText className="mr-2 h-4 w-4" />
        <span className="truncate">{file.path.split('/').pop()}</span>
      </Button>
    ));
  };


  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <AppHeader websiteName={websiteName}>
         <Button size="sm" onClick={handleDownload} disabled={loading}>
          {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {loading ? 'Zipping...' : 'Download Project'}
        </Button>
        <Button size="sm" asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Back to Generator
          </Link>
        </Button>
      </AppHeader>
      <main className="flex-1 grid grid-cols-[280px_1fr] gap-4 p-4">
        <Card className="flex flex-col h-full max-h-[calc(100vh-5.5rem)]">
          <CardHeader>
            <CardTitle>File Explorer</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-2">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-1">
                {files.length > 0 ? renderFileTree() : <p className="p-2 text-sm text-muted-foreground">No files found.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full max-h-[calc(100vh-5.5rem)]">
          <CardHeader>
            <CardTitle>{selectedFile ? selectedFile.path : 'Select a file'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
             <ScrollArea className="h-full w-full">
                <pre className="p-4 text-sm font-code">
                  <code>
                    {selectedFile ? selectedFile.content : 'Select a file from the list to view its content.'}
                  </code>
                </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
