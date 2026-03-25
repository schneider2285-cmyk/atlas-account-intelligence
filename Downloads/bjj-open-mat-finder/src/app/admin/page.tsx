'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Submission, Gym, Report } from '@/lib/types';
import { ExtractionTab } from '@/components/admin/ExtractionTab';
import {
  ShieldCheck,
  Building2,
  CalendarDays,
  Clock,
  Users,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Flag,
} from 'lucide-react';

type Tab = 'pending' | 'claims' | 'gyms' | 'reports' | 'extraction';

interface GymWithCount extends Gym {
  open_mat_count: number;
}

interface Stats {
  totalGyms: number;
  totalOpenMats: number;
  pendingSubmissions: number;
  totalUsers: number;
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [stats, setStats] = useState<Stats>({
    totalGyms: 0,
    totalOpenMats: 0,
    pendingSubmissions: 0,
    totalUsers: 0,
  });
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [claimSubmissions, setClaimSubmissions] = useState<Submission[]>([]);
  const [gyms, setGyms] = useState<GymWithCount[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && isAdmin(user.email)) {
          setAuthorized(true);
        }
      } catch {
        // not authorized
      }
      setAuthChecked(true);
    }
    checkAuth();
  }, [supabase]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const [gymsRes, openMatsRes, pendingRes, usersRes] = await Promise.all([
        supabase.from('gyms').select('id', { count: 'exact', head: true }),
        supabase.from('open_mats').select('id', { count: 'exact', head: true }),
        supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        totalGyms: gymsRes.count ?? 0,
        totalOpenMats: openMatsRes.count ?? 0,
        pendingSubmissions: pendingRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
      });
    } catch {
      // fall back to zeros
    }
  }, [supabase]);

  // Fetch pending submissions
  const fetchPending = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingSubmissions((data as Submission[]) ?? []);
    } catch {
      setPendingSubmissions([]);
    }
  }, [supabase]);

  // Fetch claim submissions (type = 'report')
  const fetchClaims = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('type', 'report')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setClaimSubmissions((data as Submission[]) ?? []);
    } catch {
      setClaimSubmissions([]);
    }
  }, [supabase]);

  // Fetch all gyms
  const fetchGyms = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('gyms')
        .select('*, open_mats(id)')
        .order('name', { ascending: true });
      const mapped: GymWithCount[] = (data ?? []).map((g: Record<string, unknown>) => ({
        ...(g as unknown as Gym),
        open_mat_count: Array.isArray(g.open_mats) ? g.open_mats.length : 0,
      }));
      setGyms(mapped);
    } catch {
      setGyms([]);
    }
  }, [supabase]);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      setReports((data as Report[]) ?? []);
    } catch {
      // Supabase unavailable — leave empty for demo mode
      setReports([]);
    }
  }, [supabase]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    Promise.all([fetchStats(), fetchPending(), fetchClaims(), fetchGyms(), fetchReports()]).finally(() =>
      setLoading(false)
    );
  }, [authorized, fetchStats, fetchPending, fetchClaims, fetchGyms, fetchReports]);

  // Actions
  async function approveSubmission(sub: Submission) {
    setActionLoading(sub.id);
    try {
      if (sub.type === 'new_gym') {
        const gymData = sub.data.gym ?? sub.data;
        const openMatData = sub.data.open_mat ?? null;
        await fetch('/api/admin/approve-gym', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submission_id: sub.id,
            gym_data: gymData,
            open_mat_data: openMatData,
          }),
        });
      } else {
        await fetch('/api/admin/update-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submission_id: sub.id, status: 'approved' }),
        });
      }
      await Promise.all([fetchStats(), fetchPending(), fetchClaims()]);
    } catch {
      // silent
    }
    setActionLoading(null);
  }

  async function rejectSubmission(sub: Submission) {
    setActionLoading(sub.id);
    try {
      await fetch('/api/admin/update-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: sub.id, status: 'rejected' }),
      });
      await Promise.all([fetchStats(), fetchPending(), fetchClaims()]);
    } catch {
      // silent
    }
    setActionLoading(null);
  }

  async function approveClaim(sub: Submission) {
    setActionLoading(sub.id);
    try {
      await fetch('/api/admin/update-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: sub.id,
          status: 'approved',
          gym_id: sub.gym_id,
          user_id: sub.user_id,
        }),
      });
      await Promise.all([fetchStats(), fetchClaims(), fetchGyms()]);
    } catch {
      // silent
    }
    setActionLoading(null);
  }

  async function deleteGym(gymId: string) {
    if (!window.confirm('Are you sure you want to delete this gym? This cannot be undone.')) {
      return;
    }
    setActionLoading(gymId);
    try {
      await fetch('/api/admin/delete-gym', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gym_id: gymId }),
      });
      await Promise.all([fetchStats(), fetchGyms()]);
    } catch {
      // silent
    }
    setActionLoading(null);
  }

  // Render helpers
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function renderDataFields(data: Record<string, unknown>) {
    return Object.entries(data).map(([key, value]) => {
      if (value && typeof value === 'object') {
        return (
          <div key={key} className="mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">{key}</span>
            <div className="ml-2 border-l-2 border-gray-200 pl-2">
              {renderDataFields(value as Record<string, unknown>)}
            </div>
          </div>
        );
      }
      return (
        <div key={key} className="flex gap-2 text-sm mb-1">
          <span className="text-gray-500 font-medium min-w-[100px]">{key}:</span>
          <span className="text-gray-900">{String(value ?? '-')}</span>
        </div>
      );
    });
  }

  // Auth check
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-500">Checking authorization...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ShieldCheck className="h-16 w-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
        <Link href="/">
          <Button variant="primary">Back to Home</Button>
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `Pending Submissions (${stats.pendingSubmissions})` },
    { key: 'claims', label: `Gym Claims (${claimSubmissions.length})` },
    { key: 'gyms', label: `All Gyms (${stats.totalGyms})` },
    { key: 'reports', label: `Reports (${reports.length})` },
    { key: 'extraction', label: 'Extraction' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-[#f97316]" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-blue-200">BJJ Open Mat Finder</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-[#1e3a5f]" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalGyms}</p>
                <p className="text-sm text-gray-500">Total Gyms</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-[#1e3a5f]" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOpenMats}</p>
                <p className="text-sm text-gray-500">Open Mats</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-[#f97316]" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingSubmissions}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3">
              <Users className="h-8 w-8 text-[#1e3a5f]" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-200 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-[#1e3a5f] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Pending Submissions */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                {pendingSubmissions.length === 0 ? (
                  <Card>
                    <CardContent>
                      <p className="py-8 text-center text-gray-500">No pending submissions.</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingSubmissions.map((sub) => (
                    <Card key={sub.id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={sub.type === 'new_gym' ? 'gi' : sub.type === 'new_open_mat' ? 'nogi' : 'default'}
                          >
                            {sub.type.replace('_', ' ')}
                          </Badge>
                          <CardTitle className="text-base">
                            {sub.user_id ? `User: ${sub.user_id.slice(0, 8)}...` : 'Anonymous'}
                          </CardTitle>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(sub.created_at)}</span>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 rounded-md bg-gray-50 p-3">
                          {renderDataFields(sub.data)}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={actionLoading === sub.id}
                            onClick={() => approveSubmission(sub)}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            {actionLoading === sub.id ? 'Processing...' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700"
                            disabled={actionLoading === sub.id}
                            onClick={() => rejectSubmission(sub)}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Claims */}
            {activeTab === 'claims' && (
              <div className="space-y-4">
                {claimSubmissions.length === 0 ? (
                  <Card>
                    <CardContent>
                      <p className="py-8 text-center text-gray-500">No pending gym claims.</p>
                    </CardContent>
                  </Card>
                ) : (
                  claimSubmissions.map((sub) => {
                    const data = sub.data as Record<string, unknown>;
                    return (
                      <Card key={sub.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-purple-100 text-purple-800">Claim</Badge>
                            <CardTitle className="text-base">
                              {String(data.gym_name || data.gymName || 'Unknown Gym')}
                            </CardTitle>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(sub.created_at)}</span>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4 space-y-1 text-sm">
                            <p>
                              <span className="font-medium text-gray-500">Claimer:</span>{' '}
                              {String(data.contact_email || data.email || sub.user_id || 'N/A')}
                            </p>
                            <p>
                              <span className="font-medium text-gray-500">Verification:</span>{' '}
                              {String(data.verification_method || data.verificationMethod || 'N/A')}
                            </p>
                            {data.notes ? (
                              <p>
                                <span className="font-medium text-gray-500">Notes:</span>{' '}
                                {String(data.notes)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={actionLoading === sub.id}
                              onClick={() => approveClaim(sub)}
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              {actionLoading === sub.id ? 'Processing...' : 'Approve Claim'}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              disabled={actionLoading === sub.id}
                              onClick={() => rejectSubmission(sub)}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject Claim
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* All Gyms */}
            {activeTab === 'gyms' && (
              <div className="space-y-2">
                {gyms.length === 0 ? (
                  <Card>
                    <CardContent>
                      <p className="py-8 text-center text-gray-500">No gyms found.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Gym</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3 text-center">Claimed</th>
                          <th className="px-4 py-3 text-center">Open Mats</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {gyms.map((gym) => (
                          <tr key={gym.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{gym.name}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {gym.city}, {gym.state}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {gym.claimed ? (
                                <Badge variant="free">Claimed</Badge>
                              ) : (
                                <Badge variant="default">Unclaimed</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">{gym.open_mat_count}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/gyms/${gym.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  disabled={actionLoading === gym.id}
                                  onClick={() => deleteGym(gym.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Extraction */}
            {activeTab === 'extraction' && <ExtractionTab />}

            {/* Reports */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <Card>
                    <CardContent>
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <Flag className="h-10 w-10 text-gray-300" />
                        <p className="text-gray-500">
                          Reports will appear here when Supabase is connected.
                        </p>
                        <p className="text-sm text-gray-400">
                          Users can report inaccurate listings, closed gyms, or spam from any gym detail page.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  reports.map((report) => (
                    <Card key={report.id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              report.reason === 'spam'
                                ? 'default'
                                : report.reason === 'closed'
                                ? 'default'
                                : 'gi'
                            }
                          >
                            {report.reason}
                          </Badge>
                          <CardTitle className="text-base">
                            Gym: {report.gym_id.slice(0, 8)}...
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              report.status === 'pending'
                                ? 'default'
                                : report.status === 'resolved'
                                ? 'free'
                                : 'nogi'
                            }
                          >
                            {report.status}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatDate(report.created_at)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 text-sm">
                          {report.details && (
                            <p>
                              <span className="font-medium text-gray-500">Details:</span>{' '}
                              {report.details}
                            </p>
                          )}
                          {report.reporter_email && (
                            <p>
                              <span className="font-medium text-gray-500">Reporter:</span>{' '}
                              {report.reporter_email}
                            </p>
                          )}
                          {report.open_mat_id && (
                            <p>
                              <span className="font-medium text-gray-500">Open Mat:</span>{' '}
                              {report.open_mat_id.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
