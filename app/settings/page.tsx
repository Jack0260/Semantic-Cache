'use client';

import { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Plus, Users, Settings as SettingsIcon, Zap, Clock, Trash2 } from 'lucide-react';
import { getCacheStore } from '@/lib/cache-store';
import { Tenant } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/format';

export default function SettingsPage() {
  const store = useMemo(() => getCacheStore(), []);
  const config = store.getConfig();
  const tenants = store.getTenants();

  const [threshold, setThreshold] = useState(config.similarity_threshold * 100);
  const [ttl, setTtl] = useState(config.cache_ttl_hours);
  const [piiEmail, setPiiEmail] = useState(config.pii_config.email);
  const [piiPhone, setPiiPhone] = useState(config.pii_config.phone);
  const [piiSsn, setPiiSsn] = useState(config.pii_config.ssn);
  const [piiCc, setPiiCc] = useState(config.pii_config.credit_card);
  const [piiEnabled, setPiiEnabled] = useState(config.pii_config.enabled);
  const [defaultModel, setDefaultModel] = useState(config.default_model);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantThreshold, setNewTenantThreshold] = useState(92);
  const [newTenantTtl, setNewTenantTtl] = useState(24);
  const [savedMsg, setSavedMsg] = useState(false);
  const [tenantVersion, setTenantVersion] = useState(0);

  const saveConfig = () => {
    store.updateConfig({
      similarity_threshold: threshold / 100,
      cache_ttl_hours: ttl,
      default_model: defaultModel,
      pii_config: {
        enabled: piiEnabled,
        email: piiEmail,
        phone: piiPhone,
        ssn: piiSsn,
        credit_card: piiCc,
      },
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const addTenant = () => {
    if (!newTenantName.trim()) return;
    store.addTenant(newTenantName, newTenantThreshold / 100, newTenantTtl);
    setNewTenantName('');
    setTenantVersion(v => v + 1);
  };

  const currentTenants = store.getTenants();

  return (
    <DashboardShell>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure cache behavior, PII scrubbing rules, and tenant management
        </p>
      </div>

      <Tabs defaultValue="cache">
        <TabsList className="mb-6">
          <TabsTrigger value="cache">
            <Zap className="h-4 w-4 mr-2" />
            Cache Config
          </TabsTrigger>
          <TabsTrigger value="pii">
            <ShieldCheck className="h-4 w-4 mr-2" />
            PII Scrubbing
          </TabsTrigger>
          <TabsTrigger value="tenants">
            <Users className="h-4 w-4 mr-2" />
            Tenants
          </TabsTrigger>
        </TabsList>

        {/* Cache Config */}
        <TabsContent value="cache" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Similarity Threshold</CardTitle>
              <CardDescription>
                Minimum cosine similarity required to serve a cached response. Higher = stricter matching, fewer false positives.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">0.80 (loose)</span>
                <span className="text-2xl font-bold text-primary">{threshold.toFixed(0)}%</span>
                <span className="text-sm text-muted-foreground">0.99 (strict)</span>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={(v) => setThreshold(v[0])}
                min={80}
                max={99}
                step={1}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Default: 92%</Badge>
                <span>At {threshold.toFixed(0)}%, questions with cosine similarity above this score will return cached answers</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Cache TTL</CardTitle>
              <CardDescription>
                How long cached responses remain valid before automatic invalidation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                  min={1}
                  max={168}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Entries expire automatically after {ttl} hours. Expired entries are not served and will trigger a fresh LLM call.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Default Model</CardTitle>
              <CardDescription>Model used when the request does not specify one.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={saveConfig}>Save Configuration</Button>
            {savedMsg && (
              <span className="text-sm text-green-500 font-medium">Saved successfully</span>
            )}
          </div>
        </TabsContent>

        {/* PII Scrubbing */}
        <TabsContent value="pii" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">PII Scrubbing Engine</CardTitle>
              <CardDescription>
                Personally identifiable information is detected and masked before storing in the cache. The original question is never persisted with PII intact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <div>
                  <p className="text-sm font-medium">Enable PII Scrubbing</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Master switch for all PII detection</p>
                </div>
                <Switch checked={piiEnabled} onCheckedChange={setPiiEnabled} />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Email Addresses</p>
                      <p className="text-xs text-muted-foreground">e.g., user@company.com → us****@ny.com</p>
                    </div>
                  </div>
                  <Switch checked={piiEmail} onCheckedChange={setPiiEmail} disabled={!piiEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Phone Numbers</p>
                      <p className="text-xs text-muted-foreground">e.g., +1 (555) 123-4567 → +1****56</p>
                    </div>
                  </div>
                  <Switch checked={piiPhone} onCheckedChange={setPiiPhone} disabled={!piiEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Social Security Numbers</p>
                      <p className="text-xs text-muted-foreground">e.g., 123-45-6789 → 12****89</p>
                    </div>
                  </div>
                  <Switch checked={piiSsn} onCheckedChange={setPiiSsn} disabled={!piiEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Credit Card Numbers</p>
                      <p className="text-xs text-muted-foreground">e.g., 4111 1111 1111 1111 → 41****11</p>
                    </div>
                  </div>
                  <Switch checked={piiCc} onCheckedChange={setPiiCc} disabled={!piiEnabled} />
                </div>
              </div>

              <Separator />

              <div className="rounded-lg bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  PII scrubbing runs before any question or answer is written to the cache. The original unscrubbed text is only kept in transient request logs for debugging. Cached entries always contain masked versions, ensuring compliance with GDPR and CCPA data minimization requirements.
                </p>
              </div>

              <Button onClick={saveConfig}>Save PII Configuration</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenants */}
        <TabsContent value="tenants" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Add New Tenant</CardTitle>
              <CardDescription>Create an isolated cache namespace for a new organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tenant Name</Label>
                  <Input
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    placeholder="e.g., Umbrella Inc"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Similarity Threshold (%)</Label>
                  <Input
                    type="number"
                    value={newTenantThreshold}
                    onChange={(e) => setNewTenantThreshold(Number(e.target.value))}
                    min={80}
                    max={99}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cache TTL (hours)</Label>
                  <Input
                    type="number"
                    value={newTenantTtl}
                    onChange={(e) => setNewTenantTtl(Number(e.target.value))}
                    min={1}
                    max={168}
                  />
                </div>
              </div>
              <Button onClick={addTenant} disabled={!newTenantName.trim()}>
                <Plus className="h-4 w-4" />
                Create Tenant
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Active Tenants</CardTitle>
              <CardDescription>Per-tenant configuration and performance summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentTenants.map((t: Tenant) => {
                const metrics = store.getMetrics(t.id);
                return (
                  <div key={t.id} className="rounded-lg border border-border/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.api_key_hash}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Threshold: {t.similarity_threshold}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Requests</p>
                        <p className="font-semibold text-sm">{metrics.total_requests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hit Rate</p>
                        <p className="font-semibold text-sm text-green-500">{formatPercent(metrics.hit_rate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost Saved</p>
                        <p className="font-semibold text-sm text-green-500">{formatCurrency(metrics.total_cost_saved)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">TTL</p>
                        <p className="font-semibold text-sm">{t.cache_ttl_hours}h</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
