'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DAY_NAMES_SHORT, formatTime } from '@/lib/types';
import type { Gym } from '@/lib/types';
import type { ValidatedOpenMat } from '@/lib/extraction/types';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExtractionGym extends Gym {
  open_mat_count: number;
}

interface ExtractionStats {
  totalWithWebsite: number;
  scraped: number;
  openMatsExtracted: number;
  failed: number;
  noSchedule: number;
  noOpenMats: number;
  needsReview: number;
}

interface PreviewData {
  gymId: string;
  gymName: string;
  openMats: ValidatedOpenMat[];
  scheduleUrl: string | null;
  platform: string | null;
}

interface BulkProgress {
  current: number;
  total: number;
  currentGym: string;
  results: { gym: string; status: string; openMats: number }[];
}

export function ExtractionTab() {
  const [gyms, setGyms] = useState<ExtractionGym[]>([]);
  const [stats, setStats] = useState<ExtractionStats>({
    totalWithWebsite: 0,
    scraped: 0,
    openMatsExtracted: 0,
    failed: 0,
    noSchedule: 0,
    noOpenMats: 0,
    needsReview: 0,
  });
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [showBulkLog, setShowBulkLog] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const bulkAbort = useRef(false);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('gyms')
        .select('*, open_mats(id)')
        .not('website', 'is', null)
        .order('name', { ascending: true });

      const mapped: ExtractionGym[] = (data ?? []).map((g: Record<string, unknown>) => ({
        ...(g as unknown as Gym),
        open_mat_count: Array.isArray(g.open_mats) ? g.open_mats.length : 0,
      }));
      setGyms(mapped);

      // Compute stats
      const s: ExtractionStats = {
        totalWithWebsite: mapped.length,
        scraped: mapped.filter((g) => g.scrape_status === 'success').length,
        openMatsExtracted: mapped.reduce((sum, g) => sum + g.open_mat_count, 0),
        failed: mapped.filter((g) => g.scrape_status === 'failed').length,
        noSchedule: mapped.filter((g) => g.scrape_status === 'no_schedule').length,
        noOpenMats: mapped.filter((g) => g.scrape_status === 'no_open_mats').length,
        needsReview: mapped.filter((g) => g.scrape_status === 'needs_review').length,
      };
      setStats(s);
    } catch {
      // silent
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleScrape(gym: ExtractionGym) {
    setScraping(gym.id);
    setPreview(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: gym.id }),
      });
      const result = await res.json();

      if (result.openMats && result.openMats.length > 0) {
        setPreview({
          gymId: gym.id,
          gymName: gym.name,
          openMats: result.openMats,
          scheduleUrl: result.scheduleUrl ?? null,
          platform: result.platform ?? null,
        });
      } else {
        // Refresh to show updated status
        await fetchData();
      }
    } catch {
      // silent
    }
    setScraping(null);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      await fetch('/api/extract', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_id: preview.gymId,
          open_mats: preview.openMats,
        }),
      });
      setPreview(null);
      await fetchData();
    } catch {
      // silent
    }
    setSaving(false);
  }

  function handleDiscard() {
    setPreview(null);
  }

  async function handleBulkScrape() {
    const unscraped = gyms.filter((g) => !g.scrape_status);
    if (unscraped.length === 0) return;

    bulkAbort.current = false;
    setBulkRunning(true);
    setShowBulkLog(true);
    const progress: BulkProgress = {
      current: 0,
      total: unscraped.length,
      currentGym: '',
      results: [],
    };
    setBulkProgress({ ...progress });

    for (const gym of unscraped) {
      if (bulkAbort.current) break;
      progress.current++;
      progress.currentGym = gym.name;
      setBulkProgress({ ...progress });

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gym_id: gym.id }),
        });
        const result = await res.json();
        const omCount = result.openMats?.length ?? 0;

        if (omCount > 0) {
          // Auto-save extracted open mats
          await fetch('/api/extract', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gym_id: gym.id, open_mats: result.openMats }),
          });
        }

        progress.results.push({
          gym: gym.name,
          status: omCount > 0 ? 'found' : result.error ? 'failed' : 'no_open_mats',
          openMats: omCount,
        });
      } catch {
        progress.results.push({ gym: gym.name, status: 'error', openMats: 0 });
      }
      setBulkProgress({ ...progress });
    }

    setBulkRunning(false);
    await fetchData();
  }

  function handleStopBulk() {
    bulkAbort.current = true;
  }

  const filteredGyms = gyms.filter((g) => {
    if (filter === 'all') return true;
    if (filter === 'not_scraped') return !g.scrape_status;
    return g.scrape_status === filter;
  });

  function statusBadge(status: string | null) {
    if (!status) return <Badge>Not scraped</Badge>;
    const map: Record<string, { label: string; className: string }> = {
      success: { label: 'Success', className: 'bg-green-100 text-green-800' },
      failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
      no_schedule: { label: 'No schedule', className: 'bg-yellow-100 text-yellow-800' },
      no_open_mats: { label: 'No open mats', className: 'bg-orange-100 text-orange-800' },
      needs_review: { label: 'Needs review', className: 'bg-purple-100 text-purple-800' },
      pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800' },
    };
    const info = map[status] ?? { label: status, className: '' };
    return <Badge className={info.className}>{info.label}</Badge>;
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-500">Loading extraction data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'With Website', value: stats.totalWithWebsite },
          { label: 'Scraped', value: stats.scraped },
          { label: 'Open Mats Found', value: stats.openMatsExtracted },
          { label: 'Failed', value: stats.failed },
          { label: 'No Schedule', value: stats.noSchedule },
          { label: 'No Open Mats', value: stats.noOpenMats },
          { label: 'Needs Review', value: stats.needsReview },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk scrape controls */}
      <div className="flex items-center gap-3">
        {!bulkRunning ? (
          <Button
            size="sm"
            className="bg-[#1e3a5f] hover:bg-[#2a4f7f]"
            onClick={handleBulkScrape}
            disabled={gyms.filter((g) => !g.scrape_status).length === 0}
          >
            <Play className="mr-1 h-4 w-4" />
            Bulk Scrape Unscraped ({gyms.filter((g) => !g.scrape_status).length})
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleStopBulk}
          >
            <Square className="mr-1 h-4 w-4" />
            Stop Bulk Scrape
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Bulk progress */}
      {bulkProgress && (
        <Card className={bulkRunning ? 'border-2 border-blue-300' : ''}>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">
              {bulkRunning
                ? `Scraping ${bulkProgress.current}/${bulkProgress.total}: ${bulkProgress.currentGym}`
                : `Bulk scrape complete: ${bulkProgress.current}/${bulkProgress.total}`}
            </CardTitle>
            <button onClick={() => setShowBulkLog(!showBulkLog)} className="text-gray-500">
              {showBulkLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardHeader>
          {bulkRunning && (
            <div className="mx-4 mb-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#1e3a5f] transition-all"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>
          )}
          {showBulkLog && bulkProgress.results.length > 0 && (
            <CardContent className="max-h-48 overflow-y-auto pt-0">
              <div className="space-y-1 text-xs">
                {bulkProgress.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {r.status === 'found' ? (
                      <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                    ) : r.status === 'failed' || r.status === 'error' ? (
                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-gray-300 flex-shrink-0" />
                    )}
                    <span className="truncate text-gray-700">{r.gym}</span>
                    {r.openMats > 0 && (
                      <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">
                        {r.openMats} mat{r.openMats !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Preview modal */}
      {preview && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">
              Preview: {preview.gymName}
              {preview.platform && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">{preview.platform}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-600">
              Found {preview.openMats.length} open mat{preview.openMats.length !== 1 ? 's' : ''}:
            </p>
            <div className="mb-4 space-y-2">
              {preview.openMats.map((om, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {DAY_NAMES_SHORT[om.day_of_week]}
                  </span>
                  <span>
                    {formatTime(om.start_time)} – {formatTime(om.end_time)}
                  </span>
                  <Badge className={om.type === 'gi' ? 'bg-blue-100 text-blue-800' : om.type === 'nogi' ? 'bg-gray-200 text-gray-800' : 'bg-purple-100 text-purple-800'}>
                    {om.type}
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-600">{om.confidence_score}</Badge>
                </div>
              ))}
            </div>
            {preview.scheduleUrl && (
              <p className="mb-3 text-xs text-gray-500">
                Source: {preview.scheduleUrl}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={saving}
                onClick={handleSave}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {saving ? 'Saving...' : 'Save to Database'}
              </Button>
              <Button
                size="sm"
                className="bg-gray-600 hover:bg-gray-700"
                disabled={saving}
                onClick={handleDiscard}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 text-sm">
        {[
          { key: 'all', label: 'All' },
          { key: 'not_scraped', label: 'Not Scraped' },
          { key: 'success', label: 'Success' },
          { key: 'failed', label: 'Failed' },
          { key: 'no_schedule', label: 'No Schedule' },
          { key: 'no_open_mats', label: 'No Open Mats' },
          { key: 'needs_review', label: 'Needs Review' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              filter === f.key
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Gym table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Gym</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Open Mats</th>
              <th className="px-4 py-3">Last Scraped</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredGyms.map((gym) => (
              <tr key={gym.id} className="hover:bg-gray-50 group">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div>{gym.name}</div>
                  {gym.scrape_error && expandedError === gym.id && (
                    <div className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 max-w-xs">
                      {gym.scrape_error}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {gym.website ? (
                    <a
                      href={gym.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Link
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {gym.platform_type ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => gym.scrape_error ? setExpandedError(expandedError === gym.id ? null : gym.id) : undefined}
                    className={gym.scrape_error ? 'cursor-pointer' : ''}
                  >
                    {statusBadge(gym.scrape_status ?? null)}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  {gym.open_mat_count > 0 ? (
                    <span className="font-semibold text-green-700">{gym.open_mat_count}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {gym.last_scraped_at
                    ? new Date(gym.last_scraped_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={scraping === gym.id || bulkRunning}
                    onClick={() => handleScrape(gym)}
                    className="text-[#1e3a5f]"
                  >
                    {scraping === gym.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1">{scraping === gym.id ? 'Scraping...' : 'Scrape'}</span>
                  </Button>
                </td>
              </tr>
            ))}
            {filteredGyms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  No gyms match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
