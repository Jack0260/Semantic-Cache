'use client';

import { DashboardShell } from '@/components/dashboard-shell';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, TrendingUp, Zap, Database, ArrowDownUp, Clock } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getCacheStore } from '@/lib/cache-store';
import { formatCurrency, formatNumber, formatLatency, formatPercent } from '@/lib/format';
import { Tenant } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';

export default function OverviewPage() {
  const store = useMemo(() => getCacheStore(), []);
  const [tenantId, setTenantId] = useState<string>('all');

  const metrics = store.getMetrics(tenantId);
  const timeSeries = store.getTimeSeries(tenantId, 30);
  const tenants = store.getTenants();

  const hitMissData = timeSeries.map(p => ({
    label: p.label,
    hits: p.hits,
    misses: p.misses,
  }));

  const costData = timeSeries.map(p => ({
    label: p.label,
    cost_saved: Number(p.cost_saved.toFixed(2)),
  }));

  const latencyData = timeSeries.map(p => ({
    label: p.label,
    p50: Math.round(p.p50_latency),
    p95: Math.round(p.p95_latency),
  }));

  const pieData = [
    { name: 'Cache Hits', value: metrics.total_hits, color: 'hsl(160, 84%, 39%)' },
    { name: 'Cache Misses', value: metrics.total_requests - metrics.total_hits, color: 'hsl(38, 92%, 50%)' },
  ];

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time metrics for your OpenAI-compatible semantic cache proxy
          </p>
        </div>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tenants</SelectItem>
            {tenants.map((t: Tenant) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Headline stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Cost Saved"
          value={formatCurrency(metrics.total_cost_saved)}
          subtitle={`${formatNumber(metrics.total_tokens_saved)} tokens saved`}
          icon={DollarSign}
          accentClass="bg-green-500/10 text-green-500"
          trend={{ value: '12.3%', positive: true }}
        />
        <StatCard
          title="Cache Hit Rate"
          value={formatPercent(metrics.hit_rate)}
          subtitle={`${metrics.total_hits} of ${metrics.total_requests} requests`}
          icon={TrendingUp}
          accentClass="bg-primary/10 text-primary"
          trend={{ value: '5.2%', positive: true }}
        />
        <StatCard
          title="p95 Latency"
          value={formatLatency(metrics.p95_latency)}
          subtitle={`Hit: ${formatLatency(metrics.p95_cache_hit_latency)} · Miss: ${formatLatency(metrics.p95_cache_miss_latency)}`}
          icon={Zap}
          accentClass="bg-yellow-500/10 text-yellow-500"
          trend={{ value: '8.1%', positive: true }}
        />
        <StatCard
          title="Cost Reduction"
          value={`${metrics.cost_reduction_percent.toFixed(0)}%`}
          subtitle={`${metrics.active_cache_entries} active cache entries`}
          icon={ArrowDownUp}
          accentClass="bg-primary/10 text-primary"
          trend={{ value: '3.4%', positive: true }}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Cost savings chart */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Cost Savings Over Time</CardTitle>
            <CardDescription>Cumulative dollar amount saved by serving cached responses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={costData}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost Saved']}
                />
                <Area
                  type="monotone"
                  dataKey="cost_saved"
                  stroke="hsl(160, 84%, 39%)"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hit/Miss pie */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Cache Distribution</CardTitle>
            <CardDescription>Hit vs miss breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hit/Miss bar chart */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Daily Cache Hits vs Misses</CardTitle>
            <CardDescription>30-day request breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hitMissData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="hits" stackId="a" fill="hsl(160, 84%, 39%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="misses" stackId="a" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latency chart */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Latency: p50 vs p95</CardTitle>
            <CardDescription>Response time trends (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}ms`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="p50" stroke="hsl(199, 89%, 48%)" strokeWidth={2} dot={false} name="p50" />
                <Line type="monotone" dataKey="p95" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="p95" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-tenant breakdown */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Tenant Performance</CardTitle>
          <CardDescription>Per-tenant metrics across all cache operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tenants.map((t: Tenant) => {
              const tMetrics = store.getMetrics(t.id);
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Requests</p>
                      <p className="text-sm font-semibold">{formatNumber(tMetrics.total_requests)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Hit Rate</p>
                      <p className="text-sm font-semibold text-green-500">{formatPercent(tMetrics.hit_rate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cost Saved</p>
                      <p className="text-sm font-semibold text-green-500">{formatCurrency(tMetrics.total_cost_saved)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">p95</p>
                      <p className="text-sm font-semibold">{formatLatency(tMetrics.p95_latency)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
