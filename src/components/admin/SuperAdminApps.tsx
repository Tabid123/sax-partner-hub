import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw, Smartphone, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'apps';

const fmtSize = (b?: number) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function SuperAdminApps() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['manual-apks'],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data ?? []).filter((f) => f.name !== '.emptyFolderPlaceholder');
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, {
        upsert: true,
        contentType: file.type || 'application/vnd.android.package-archive',
      });
      if (error) throw error;
      toast.success('App-ka waa la geliyay');
      qc.invalidateQueries({ queryKey: ['manual-apks'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Lama gelin karin');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (name: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 60 * 60, {
      download: name,
    });
    if (error || !data?.signedUrl) return toast.error('Lama soo dejin karin');
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleDelete = async (name: string) => {
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) return toast.error('Lama tirtiri karin');
    toast.success('Waa la tirtiray');
    qc.invalidateQueries({ queryKey: ['manual-apks'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Smartphone className="h-5 w-5 text-primary" /> Apps (APK)
          </h2>
          <p className="text-sm text-muted-foreground">
            Halkan keliya ayaa APK laga gelin karaa. Resellers-ka way soo dejisan karaan oo keliya.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Cusboonaysii
          </Button>
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Geli APK
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Weli APK lama gelin. Riix "Geli APK" si aad u soo gudbiso app-ka.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {files.map((f) => (
          <Card key={f.name}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize((f.metadata as any)?.size)} · {fmtDate(f.created_at as string)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleDownload(f.name)}>
                  <Download className="h-4 w-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(f.name)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
