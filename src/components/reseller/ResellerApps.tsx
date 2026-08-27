import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'apps';

const fmtSize = (b?: number) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function ResellerApps() {
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

  const handleDownload = async (name: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 60 * 60, {
      download: name,
    });
    if (error || !data?.signedUrl) return toast.error('Lama soo dejin karin');
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Smartphone className="h-6 w-6 text-primary" /> Apps
          </h2>
          <p className="text-sm text-muted-foreground">
            App-yada la kuu diyaariyay halkan ka soo deji.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Cusboonaysii
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Weli app lama diyaarin.
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
              <Button size="sm" onClick={() => handleDownload(f.name)}>
                <Download className="mr-2 h-4 w-4" /> Soo deji
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
