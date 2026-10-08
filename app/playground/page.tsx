'use client';

import { useState, useMemo, useCallback } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, DollarSign, Target, Send, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { getCacheStore } from '@/lib/cache-store';
import { ChatCompletionRequest, ChatCompletionResponse, Tenant } from '@/lib/types';
import { formatCurrency, formatLatency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PlaygroundResult {
  response: ChatCompletionResponse;
  question: string;
  timestamp: number;
}

const EXAMPLE_QUESTIONS = [
  'Tell me about refunds',
  'How do I get my money back?',
  'I forgot my password, help',
  'How much does it cost?',
  'How do I cancel my plan?',
  'How do you handle my data?',
  'API rate limit exceeded error',
  'Nonprofit pricing available?',
];

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

export default function PlaygroundPage() {
  const store = useMemo(() => getCacheStore(), []);
  const tenants = store.getTenants();

  const [question, setQuestion] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [tenantId, setTenantId] = useState(tenants[0]?.id || 'tenant_acme');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [history, setHistory] = useState<PlaygroundResult[]>([]);

  const sendRequest = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);

    await new Promise(r => setTimeout(r, 100));

    const request: ChatCompletionRequest = {
      model,
      messages: [
        { role: 'user', content: question },
      ],
    };

    const response = store.proxyRequest(request, tenantId);
    const res: PlaygroundResult = { response, question, timestamp: Date.now() };
    setResult(res);
    setHistory(prev => [res, ...prev].slice(0, 10));
    setLoading(false);
  }, [question, model, tenantId, loading, store]);

  const cacheInfo = result?.response._semantic_cache;
  const isHit = cacheInfo?.hit;

  return (
    <DashboardShell>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Playground</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Send requests through the semantic cache proxy and see hit/miss results in real-time
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Request panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Request</CardTitle>
              <CardDescription>Simulates a call to POST /v1/chat/completions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tenant</label>
                  <Select value={tenantId} onValueChange={setTenantId}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t: Tenant) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">User Message</label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question... (e.g., 'Tell me about refunds')"
                  className="min-h-[100px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      sendRequest();
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_QUESTIONS.slice(0, 4).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={sendRequest}
                  disabled={!question.trim() || loading}
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result panel */}
          {result && (
            <Card className={cn(
              'border-border/60 transition-all',
              isHit ? 'ring-1 ring-green-500/30' : 'ring-1 ring-yellow-500/20'
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Response</CardTitle>
                  {isHit ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/10">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Cache Hit
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10">
                      <XCircle className="h-3 w-3 mr-1" />
                      Cache Miss
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Response metrics */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg bg-secondary/50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" /> Latency
                    </div>
                    <p className={cn(
                      'text-sm font-bold',
                      isHit ? 'text-green-500' : 'text-yellow-500'
                    )}>
                      {formatLatency(cacheInfo?.latency_ms || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Target className="h-3 w-3" /> Similarity
                    </div>
                    <p className="text-sm font-bold">
                      {cacheInfo?.similarity_score !== null
                        ? `${((cacheInfo?.similarity_score || 0) * 100).toFixed(1)}%`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3" /> Cost Saved
                    </div>
                    <p className={cn(
                      'text-sm font-bold',
                      isHit ? 'text-green-500' : 'text-muted-foreground'
                    )}>
                      {formatCurrency(cacheInfo?.cost_saved || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Zap className="h-3 w-3" /> Tokens
                    </div>
                    <p className="text-sm font-bold">
                      {result.response.usage.total_tokens}
                    </p>
                  </div>
                </div>

                {/* Response content */}
                <div className="rounded-lg border border-border/50 p-4 bg-secondary/20">
                  <p className="text-sm leading-relaxed">{result.response.choices[0].message.content}</p>
                </div>

                {/* Similarity comparison */}
                {!isHit && cacheInfo?.similarity_score !== null && cacheInfo?.similarity_score! > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Closest cached match:</span>
                    <Badge variant="outline" className="text-xs">
                      {((cacheInfo?.similarity_score || 0) * 100).toFixed(1)}% — below threshold
                    </Badge>
                  </div>
                )}
                {isHit && (
                  <div className="flex items-center gap-2 text-xs text-green-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Served from cache — no LLM call made</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary mb-3">
                  <Send className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Send a request to see the semantic cache in action</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try asking the same question in different words to trigger a cache hit</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History & examples sidebar */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Try These</CardTitle>
              <CardDescription>Questions that will trigger cache hits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="w-full text-left rounded-lg border border-border/50 px-3 py-2.5 text-sm transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <span className="text-muted-foreground">"{q}"</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Recent Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h, i) => {
                  const info = h.response._semantic_cache;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => setResult(h)}
                    >
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
                        info?.hit ? 'bg-green-500/10' : 'bg-yellow-500/10'
                      )}>
                        {info?.hit ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{h.question}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatLatency(info?.latency_ms || 0)} · {info?.hit ? formatCurrency(info.cost_saved) + ' saved' : 'forwarded to LLM'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
