import { createServerFn } from '@tanstack/react-start';

const REPO = 'Tabid123/remix-of-iftin-resseler-sax-ah';

export interface ApkAsset {
  name: string;
  url: string;
  size: number;
}

export interface ApkRelease {
  tag: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  assets: ApkAsset[];
}

export interface ApkListResult {
  releases: ApkRelease[];
  error?: string;
}

export const listApkReleases = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ApkListResult> => {
    const token = process.env['GITHUB_PERSONAL_ACCESS_TOKEN'] || process.env['GITHUB_TOKEN'];
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'iftin-reseller',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers,
    });

    if (!res.ok) {
      return {
        releases: [],
        error:
          res.status === 404
            ? 'Repo-ga lama helin ama waa private — fadlan hubi GITHUB_TOKEN.'
            : `GitHub error ${res.status}`,
      };
    }

    const data = (await res.json()) as any[];
    const releases: ApkRelease[] = data
      .map((r) => ({
        tag: r.tag_name as string,
        name: (r.name || r.tag_name) as string,
        prerelease: Boolean(r.prerelease),
        publishedAt: r.published_at as string,
        htmlUrl: r.html_url as string,
        assets: (r.assets || [])
          .filter((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
          .map((a: any) => ({
            name: a.name as string,
            url: a.url as string,
            size: a.size as number,
          })),
      }))
      .filter((r) => r.assets.length > 0)
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )
      // Kaliya APK-ga ugu dambeeyay
      .slice(0, 1);

    return { releases };

  },
);

export const downloadApkUrl = createServerFn({ method: 'GET' })
  .inputValidator((data: { assetUrl: string }) => {
    if (!data?.assetUrl?.startsWith('https://api.github.com/repos/')) {
      throw new Error('Invalid asset url');
    }
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const token = process.env['GITHUB_PERSONAL_ACCESS_TOKEN'] || process.env['GITHUB_TOKEN'];
    const res = await fetch(data.assetUrl, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'iftin-reseller',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: 'manual',
    });
    const loc = res.headers.get('location');
    return { url: loc };
  });
