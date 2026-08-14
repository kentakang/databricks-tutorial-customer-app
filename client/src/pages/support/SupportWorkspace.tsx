import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  ScrollArea,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { BookOpen, Clock3, Mail, MapPin, Package, Phone, Search, ShieldCheck, UserRound } from 'lucide-react';
import { formatCustomerLevel, toReadableSourcePreview } from '../../lib/display';
import { SupportAgentPanel } from './SupportAgentPanel';

interface Viewer {
  email: string | null;
  user: string | null;
}

const queueSkeletonKeys = ['queue-1', 'queue-2', 'queue-3', 'queue-4', 'queue-5', 'queue-6'];
const sourceSkeletonKeys = ['source-1', 'source-2', 'source-3'];

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function QueryError() {
  return (
    <Alert variant="destructive">
      <AlertDescription>정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</AlertDescription>
    </Alert>
  );
}

function viewerLabel(viewer: Viewer | null) {
  return viewer?.email?.trim() || viewer?.user?.trim() || '';
}

export function SupportWorkspace() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedInteractionId, setSelectedInteractionId] = useState('');
  const queueParams = useMemo(() => ({}), []);
  const {
    data: queue,
    loading: queueLoading,
    error: queueError,
  } = useAnalyticsQuery('recent_interactions', queueParams);

  const filteredQueue = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase('ko-KR');
    if (!queue || !keyword) return queue ?? [];
    return queue.filter((item) =>
      [item.customer_name, item.issue_category, item.issue_description, item.interaction_id]
        .join(' ')
        .toLocaleLowerCase('ko-KR')
        .includes(keyword)
    );
  }, [queue, searchText]);

  useEffect(() => {
    fetch('/api/whoami')
      .then((response) => response.json() as Promise<Viewer>)
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  const effectiveInteractionId = filteredQueue.some((item) => item.interaction_id === selectedInteractionId)
    ? selectedInteractionId
    : (filteredQueue[0]?.interaction_id ?? '');
  const selectedQueueItem = queue?.find((item) => item.interaction_id === effectiveInteractionId);
  const customerId = selectedQueueItem?.customer_id ?? '';
  const issueText = selectedQueueItem?.issue_description ?? '';

  const detailParams = useMemo(
    () => ({ interaction_id: sql.string(effectiveInteractionId) }),
    [effectiveInteractionId]
  );
  const customerParams = useMemo(() => ({ customer_id: sql.string(customerId) }), [customerId]);
  const sourceParams = useMemo(() => ({ query_text: sql.string(issueText) }), [issueText]);

  const {
    data: details,
    loading: detailLoading,
    error: detailError,
  } = useAnalyticsQuery('interaction_detail', detailParams, {
    autoStart: Boolean(effectiveInteractionId),
  });
  const {
    data: orders,
    loading: ordersLoading,
    error: ordersError,
  } = useAnalyticsQuery('customer_orders', customerParams, {
    autoStart: Boolean(customerId),
  });
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useAnalyticsQuery('customer_history', customerParams, {
    autoStart: Boolean(customerId),
  });
  const {
    data: sources,
    loading: sourcesLoading,
    error: sourcesError,
  } = useAnalyticsQuery('support_sources', sourceParams, {
    autoStart: Boolean(issueText),
  });

  const detail = details?.[0];
  const signedInLabel = viewerLabel(viewer);
  const agentContext = useMemo(() => {
    if (!detail) return null;
    return {
      interaction: detail,
      recent_orders: orders ?? [],
      interaction_history: history ?? [],
      retrieved_sources: (sources ?? []).map((source) => ({
        source_type: source.source_type,
        source_id: source.source_id,
        title: source.title,
        content: source.content.slice(0, 1600),
      })),
    };
  }, [detail, history, orders, sources]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3 lg:px-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="font-semibold tracking-tight">Support Copilot</h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">고객 문맥과 승인된 문서에 근거한 상담 답변 제안</p>
          </div>
          {signedInLabel ? <p className="text-sm font-medium">{signedInLabel}</p> : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[310px_minmax(0,1fr)_430px] lg:p-6">
        <Card className="h-[calc(100vh-7.5rem)] overflow-hidden shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">최근 상담</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="고객, 분류, 문의 검색"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {queueLoading ? (
              <div className="space-y-3 p-4">
                {queueSkeletonKeys.map((key) => (
                  <Skeleton key={key} className="h-20 w-full" />
                ))}
              </div>
            ) : queueError ? (
              <div className="p-4">
                <QueryError />
              </div>
            ) : filteredQueue.length === 0 ? (
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyTitle>검색 결과 없음</EmptyTitle>
                  <EmptyDescription>다른 검색어를 입력해 보세요.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="h-[calc(100vh-14rem)]">
                <div className="divide-y">
                  {filteredQueue.map((item) => {
                    const selected = item.interaction_id === effectiveInteractionId;
                    return (
                      <Button
                        key={item.interaction_id}
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-none px-4 py-3 text-left ${
                          selected ? 'bg-primary/[0.08]' : ''
                        }`}
                        onClick={() => setSelectedInteractionId(item.interaction_id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{item.customer_name}</span>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {formatCustomerLevel(item.customer_level)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium text-primary">{item.issue_category}</p>
                          <p className="mt-1 line-clamp-2 whitespace-normal text-xs leading-5 text-muted-foreground">
                            {item.issue_description}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {formatTimestamp(item.interacted_at)}
                          </p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-52 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : detailError ? (
            <QueryError />
          ) : !detail ? (
            <Card>
              <Empty className="py-24">
                <EmptyHeader>
                  <EmptyTitle>상담 건을 선택하세요</EmptyTitle>
                  <EmptyDescription>왼쪽 목록에서 확인할 상담을 선택합니다.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge>{detail.issue_category}</Badge>
                      </div>
                      <CardTitle className="text-lg">{detail.customer_name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(detail.interacted_at)}</p>
                    </div>
                    <Badge variant="secondary">{formatCustomerLevel(detail.customer_level)} 고객</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6">{detail.issue_description}</div>
                  <Separator className="my-4" />
                  <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex min-w-0 gap-2">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{detail.email}</span>
                    </div>
                    <div className="flex gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{detail.phone}</span>
                    </div>
                    <div className="flex min-w-0 gap-2 sm:col-span-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{detail.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <Tabs defaultValue="orders">
                    <TabsList>
                      <TabsTrigger value="orders">
                        <Package className="mr-2 h-4 w-4" /> 최근 주문
                      </TabsTrigger>
                      <TabsTrigger value="history">
                        <UserRound className="mr-2 h-4 w-4" /> 상담 이력
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="orders" className="mt-4">
                      {ordersLoading ? (
                        <Skeleton className="h-52 w-full" />
                      ) : ordersError ? (
                        <QueryError />
                      ) : !orders?.length ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">주문 이력이 없습니다.</p>
                      ) : (
                        <div className="divide-y rounded-lg border">
                          {orders.map((order) => (
                            <div
                              key={order.transaction_id}
                              className="flex flex-wrap items-center justify-between gap-3 p-3"
                            >
                              <div>
                                <p className="text-sm font-medium">{order.product_name}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {order.product_category} · {order.product_sub_category}
                                </p>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p>{formatTimestamp(order.ordered_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="history" className="mt-4">
                      {historyLoading ? (
                        <Skeleton className="h-52 w-full" />
                      ) : historyError ? (
                        <QueryError />
                      ) : !history?.length ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">이전 상담 이력이 없습니다.</p>
                      ) : (
                        <div className="space-y-3">
                          {history.map((item) => (
                            <div key={item.interaction_id} className="rounded-lg border p-3">
                              <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline">{item.issue_category}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(item.interacted_at)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6">{item.issue_description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <SupportAgentPanel
            context={agentContext}
            disabled={detailLoading || ordersLoading || historyLoading || sourcesLoading}
          />

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                검색 근거
              </CardTitle>
              <p className="text-xs text-muted-foreground">선택한 문의와 관련된 정책·상품 문서</p>
            </CardHeader>
            <CardContent>
              {sourcesLoading ? (
                <div className="space-y-2">
                  {sourceSkeletonKeys.map((key) => (
                    <Skeleton key={key} className="h-16 w-full" />
                  ))}
                </div>
              ) : sourcesError ? (
                <QueryError />
              ) : !sources?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  상담을 선택하면 관련 문서를 검색합니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => {
                    const preview = toReadableSourcePreview(source.content, 160, source.title);
                    return (
                      <div key={source.document_id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{source.title}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {source.source_type === 'policy' ? '정책' : '상품 문서'}
                          </Badge>
                        </div>
                        {preview ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{preview}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
