'use client';

import { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Trash2, Database, ShieldCheck, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getCacheStore } from '@/lib/cache-store';
import { CacheEntry, Tenant } from '@/lib/types';
import { formatCurrency, formatTimeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function CacheInspectorPage() {
  const store = useMemo(() => getCacheStore(), []);
  const tenants = store.getTenants();
  const [tenantId, setTenantId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'hits' | 'recent' | 'cost'>('hits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = () => setVersion(v => v + 1);

  let entries = store.getEntries(tenantId);
  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e =>
      e.question.toLowerCase().includes(q) ||
      e.answer.toLowerCase().includes(q)
    );
  }

  entries = [...entries].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'hits') cmp = a.hit_count - b.hit_count;
    if (sortBy === 'recent') cmp = a.last_accessed - b.last_accessed;
    if (sortBy === 'cost') cmp = a.cost_saved - b.cost_saved;
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const totalCostSaved = entries.reduce((s, e) => s + e.cost_saved * e.hit_count, 0);
  const totalHits = entries.reduce((s, e) => s + e.hit_count, 0);
  const tenantName = (id: string) => tenants.find(t => t.id === id)?.name || id;

  const toggleSort = (col: 'hits' | 'recent' | 'cost') => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: 'hits' | 'recent' | 'cost' }) => {
    if (sortBy !== col) return null;
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronUp className="h-3 w-3 inline" />;
  };

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cache Inspector</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage cached question-answer pairs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {tenants.map((t: Tenant) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tenantId !== 'all' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                  Clear Tenant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all cache entries for {tenantName(tenantId)}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all cached responses for this tenant. New requests will be forwarded to the LLM until the cache is rebuilt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { store.invalidateByTenant(tenantId); refresh(); }}>
                    Clear Cache
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{entries.length}</p>
                <p className="text-xs text-muted-foreground">Cached Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHits}</p>
                <p className="text-xs text-muted-foreground">Total Cache Hits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalCostSaved)}</p>
                <p className="text-xs text-muted-foreground">Total Cost Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cached questions and answers..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Question</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('hits')}>
                  Hits <SortIcon col="hits" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('cost')}>
                  Cost Saved <SortIcon col="cost" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('recent')}>
                  Last Accessed <SortIcon col="recent" />
                </TableHead>
                <TableHead>PII</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No cache entries found
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry: CacheEntry) => (
                <>
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        {expandedId === entry.id ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0 rotate-90" />
                        )}
                        <span className="truncate max-w-md">{entry.question_scrubbed}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{tenantName(entry.tenant_id)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">{entry.hit_count}</Badge>
                    </TableCell>
                    <TableCell className="text-green-500 font-medium text-sm">
                      {formatCurrency(entry.cost_saved * entry.hit_count)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimeAgo(entry.last_accessed)}
                    </TableCell>
                    <TableCell>
                      {entry.pii_flags.length > 0 ? (
                        <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/10 text-xs">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {entry.pii_flags.length}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Invalidate this cache entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cached response will be removed. The next similar request will be forwarded to the LLM.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { store.invalidateEntry(entry.id); refresh(); }}>
                              Invalidate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                  {expandedId === entry.id && (
                    <TableRow key={entry.id + '-detail'} className="bg-secondary/10">
                      <TableCell colSpan={7} className="py-4">
                        <div className="space-y-3 px-4">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Cached Answer (PII-scrubbed)</p>
                            <div className="rounded-lg border border-border/40 p-3 bg-card">
                              <p className="text-sm leading-relaxed">{entry.answer_scrubbed}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">Model: </span>
                              <span className="font-mono">{entry.model}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Threshold: </span>
                              <span className="font-mono">{entry.similarity_threshold}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tokens saved: </span>
                              <span className="font-mono">{entry.tokens_saved}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created: </span>
                              <span>{formatTimeAgo(entry.created_at)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expires: </span>
                              <span>{formatTimeAgo(entry.expires_at)}</span>
                            </div>
                          </div>
                          {entry.pii_flags.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-muted-foreground">PII scrubbed before caching:</span>
                              {entry.pii_flags.map((f, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {f.type}: {f.masked}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
