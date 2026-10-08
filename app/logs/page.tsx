'use client';

import { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CheckCircle2, XCircle, Clock, DollarSign, ShieldCheck, Filter } from 'lucide-react';
import { getCacheStore } from '@/lib/cache-store';
import { RequestLog, Tenant } from '@/lib/types';
import { formatCurrency, formatLatency, formatTimeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function RequestLogsPage() {
  const store = useMemo(() => getCacheStore(), []);
  const tenants = store.getTenants();
  const [tenantId, setTenantId] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'hits' | 'misses'>('all');
  const [limit, setLimit] = useState(100);

  let logs = store.getLogs(tenantId, limit * 3);
  if (filter === 'hits') logs = logs.filter(l => l.cache_hit);
  if (filter === 'misses') logs = logs.filter(l => !l.cache_hit);
  logs = logs.slice(0, limit);

  const totalRequests = logs.length;
  const totalHits = logs.filter(l => l.cache_hit).length;
  const totalCostSaved = logs.reduce((s, l) => s + l.cost_saved, 0);
  const avgLatency = totalRequests > 0 ? logs.reduce((s, l) => s + l.latency_ms, 0) / totalRequests : 0;
  const tenantName = (id: string) => tenants.find(t => t.id === id)?.name || id;

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Request Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Every request through the proxy, with cache status and latency
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
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
            <p className="text-xl font-bold">{totalRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Cache Hits</p>
            <p className="text-xl font-bold text-green-500">{totalHits}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Cost Saved</p>
            <p className="text-xl font-bold text-green-500">{formatCurrency(totalCostSaved)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg Latency</p>
            <p className="text-xl font-bold">{formatLatency(avgLatency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as 'all' | 'hits' | 'misses')}>
          <ToggleGroupItem value="all" className="text-xs">All</ToggleGroupItem>
          <ToggleGroupItem value="hits" className="text-xs">Hits Only</ToggleGroupItem>
          <ToggleGroupItem value="misses" className="text-xs">Misses Only</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-[35%]">Question</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Similarity</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>PII</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      No requests found
                    </TableCell>
                  </TableRow>
                )}
                {logs.map((log: RequestLog) => (
                  <TableRow key={log.id} className="hover:bg-secondary/20">
                    <TableCell>
                      {log.cache_hit ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-xs font-medium text-green-500">Hit</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-xs font-medium text-yellow-500">Miss</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-xs">
                      {log.question}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tenantName(log.tenant_id)}
                    </TableCell>
                    <TableCell>
                      {log.similarity_score !== null ? (
                        <span className={cn(
                          'text-xs font-mono',
                          log.similarity_score >= 0.92 ? 'text-green-500' : 'text-muted-foreground'
                        )}>
                          {(log.similarity_score * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          'text-xs font-mono',
                          log.cache_hit ? 'text-green-500' : 'text-yellow-500'
                        )}>
                          {formatLatency(log.latency_ms)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.cost_saved > 0 ? (
                        <span className="text-xs font-medium text-green-500">
                          +{formatCurrency(log.cost_saved)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(log.cost)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.tokens}
                    </TableCell>
                    <TableCell>
                      {log.pii_scrubbed ? (
                        <ShieldCheck className="h-4 w-4 text-orange-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(log.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
