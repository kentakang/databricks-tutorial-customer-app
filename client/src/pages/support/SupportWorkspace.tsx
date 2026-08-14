import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
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
import {
  BookOpen,
  Calendar,
  Clock3,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Tag,
  User,
  UserRound,
  X,
} from 'lucide-react';
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

function formatRelativeOrDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24 && diffHours > 0) {
    const hours = Math.floor(diffHours);
    return hours === 0 ? '방금 전' : `${hours}시간 전`;
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
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

function getInitials(name: string | null | undefined) {
  if (!name) return '고객';
  return name.slice(0, 2);
}

function getLevelBadgeVariant(level: string | null | undefined): 'default' | 'secondary' | 'outline' {
  const normalized = level?.toLowerCase() || '';
  if (normalized.includes('vip') || normalized.includes('gold')) return 'default';
  if (normalized.includes('silver')) return 'secondary';
  return 'outline';
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
    <div className="min-h-screen bg-muted/20 text-foreground">
      {/* Top App Header */}
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1880px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-xs ring-1 ring-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight sm:text-lg">Support Copilot</h1>
                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground">고객 문맥과 승인된 문서에 근거한 상담 답변 제안</p>
            </div>
          </div>
          {signedInLabel ? (
            <div className="flex items-center gap-2.5 rounded-full border bg-background/80 px-3 py-1.5 shadow-2xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs font-medium text-foreground">{signedInLabel}</p>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <main className="mx-auto grid max-w-[1880px] gap-4 p-4 lg:grid-cols-[330px_minmax(0,1fr)_440px] lg:p-6">
        {/* Left Column: Recent Interactions List */}
        <Card className="flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden border shadow-sm">
          <CardHeader className="border-b bg-card/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold tracking-tight sm:text-base">최근 상담</CardTitle>
              {filteredQueue.length > 0 && (
                <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-medium">
                  {filteredQueue.length}건
                </Badge>
              )}
            </div>
            <div className="relative mt-2.5">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="고객, 분류, 문의 검색"
                className="h-9 rounded-lg bg-background/80 pl-8.5 pr-8 text-xs shadow-2xs focus-visible:ring-1"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {queueLoading ? (
              <div className="space-y-3 p-4">
                {queueSkeletonKeys.map((key) => (
                  <Skeleton key={key} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : queueError ? (
              <div className="p-4">
                <QueryError />
              </div>
            ) : filteredQueue.length === 0 ? (
              <Empty className="py-20">
                <EmptyHeader>
                  <EmptyTitle>검색 결과 없음</EmptyTitle>
                  <EmptyDescription>다른 검색어를 입력해 보세요.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="h-[calc(100vh-14.5rem)]">
                <div className="divide-y divide-border/60">
                  {filteredQueue.map((item) => {
                    const selected = item.interaction_id === effectiveInteractionId;
                    return (
                      <button
                        key={item.interaction_id}
                        type="button"
                        className={`group relative flex w-full flex-col gap-1.5 p-3.5 text-left transition-colors hover:bg-muted/40 ${
                          selected ? 'bg-primary/[0.06] shadow-2xs' : ''
                        }`}
                        onClick={() => setSelectedInteractionId(item.interaction_id)}
                      >
                        {selected && <span className="absolute inset-y-0 left-0 w-1 rounded-r-sm bg-primary" />}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-6 w-6 shrink-0 text-[11px] font-semibold">
                              <AvatarFallback
                                className={
                                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }
                              >
                                {getInitials(item.customer_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                              {item.customer_name}
                            </span>
                          </div>
                          <Badge
                            variant={getLevelBadgeVariant(item.customer_level)}
                            className="shrink-0 text-[10px] px-1.5 py-0 h-4.5"
                          >
                            {formatCustomerLevel(item.customer_level)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {item.issue_category}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                            <Clock3 className="h-3 w-3" />
                            {formatRelativeOrDate(item.interacted_at)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {item.issue_description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Center Column: Customer Context & History */}
        <div className="min-w-0 space-y-4">
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : detailError ? (
            <QueryError />
          ) : !detail ? (
            <Card className="border shadow-sm">
              <Empty className="py-28">
                <EmptyHeader>
                  <EmptyTitle>상담 건을 선택하세요</EmptyTitle>
                  <EmptyDescription>왼쪽 목록에서 확인할 상담을 선택합니다.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          ) : (
            <>
              {/* Customer Detail Card */}
              <Card className="border shadow-sm">
                <CardHeader className="border-b bg-card/60 pb-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 text-sm font-bold shadow-2xs ring-1 ring-border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(detail.customer_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold tracking-tight sm:text-lg">
                            {detail.customer_name}
                          </CardTitle>
                          <Badge variant={getLevelBadgeVariant(detail.customer_level)} className="text-[11px]">
                            {formatCustomerLevel(detail.customer_level)} 고객
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatTimestamp(detail.interacted_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/5 text-primary text-xs font-semibold px-2.5 py-1"
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      {detail.issue_category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Current Issue Callout Box */}
                  <div className="relative rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>문의 내용</span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground sm:text-sm font-normal">
                      {detail.issue_description}
                    </p>
                  </div>

                  <Separator />

                  {/* Customer Contact Details Grid */}
                  <div className="grid gap-2.5 text-xs sm:grid-cols-2 xl:grid-cols-3">
                    <div className="flex items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 shadow-2xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">이메일</p>
                        <p className="truncate font-medium text-foreground">{detail.email || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 shadow-2xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">연락처</p>
                        <p className="truncate font-medium text-foreground">{detail.phone || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 shadow-2xs sm:col-span-2 xl:col-span-1">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          배송지 주소
                        </p>
                        <p className="truncate font-medium text-foreground">{detail.address || '—'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs: Recent Orders & Interaction History */}
              <Card className="border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <Tabs defaultValue="orders">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1">
                      <TabsTrigger
                        value="orders"
                        className="flex items-center gap-2 text-xs font-semibold data-[state=active]:shadow-xs"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>최근 주문</span>
                        {orders && orders.length > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                            {orders.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="history"
                        className="flex items-center gap-2 text-xs font-semibold data-[state=active]:shadow-xs"
                      >
                        <UserRound className="h-3.5 w-3.5" />
                        <span>상담 이력</span>
                        {history && history.length > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                            {history.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    {/* Orders Tab Content */}
                    <TabsContent value="orders" className="mt-4">
                      {ordersLoading ? (
                        <div className="space-y-2.5">
                          <Skeleton className="h-16 w-full rounded-lg" />
                          <Skeleton className="h-16 w-full rounded-lg" />
                        </div>
                      ) : ordersError ? (
                        <QueryError />
                      ) : !orders?.length ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">주문 이력이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orders.map((order) => (
                            <div
                              key={order.transaction_id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/60 p-3 shadow-2xs transition-colors hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Package className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                                    {order.product_name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {order.product_category} · {order.product_sub_category}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatTimestamp(order.ordered_at)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* History Tab Content */}
                    <TabsContent value="history" className="mt-4">
                      {historyLoading ? (
                        <div className="space-y-2.5">
                          <Skeleton className="h-20 w-full rounded-lg" />
                          <Skeleton className="h-20 w-full rounded-lg" />
                        </div>
                      ) : historyError ? (
                        <QueryError />
                      ) : !history?.length ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <UserRound className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">이전 상담 이력이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {history.map((item) => (
                            <div key={item.interaction_id} className="rounded-xl border bg-card/60 p-3.5 shadow-2xs">
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant="outline" className="text-[10px] font-semibold">
                                  {item.issue_category}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock3 className="h-3 w-3" />
                                  {formatTimestamp(item.interacted_at)}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-foreground sm:text-sm">
                                {item.issue_description}
                              </p>
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

        {/* Right Column: AI Assistant & Retrieved Evidence */}
        <div className="min-w-0 space-y-4">
          <SupportAgentPanel
            context={agentContext}
            disabled={detailLoading || ordersLoading || historyLoading || sourcesLoading}
          />

          {/* Retrieved Sources Card */}
          <Card className="border shadow-sm">
            <CardHeader className="border-b bg-card/60 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight sm:text-base">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <span>검색 근거</span>
                </CardTitle>
                {sources && sources.length > 0 && (
                  <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-medium">
                    {sources.length}개 문서
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">선택한 문의와 관련된 정책·상품 문서</p>
            </CardHeader>
            <CardContent className="pt-3">
              {sourcesLoading ? (
                <div className="space-y-2">
                  {sourceSkeletonKeys.map((key) => (
                    <Skeleton key={key} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : sourcesError ? (
                <QueryError />
              ) : !sources?.length ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  상담을 선택하면 관련 문서를 검색합니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => {
                    const preview = toReadableSourcePreview(source.content, 160, source.title);
                    const isPolicy = source.source_type === 'policy';
                    return (
                      <div
                        key={source.document_id}
                        className="rounded-xl border bg-card/60 p-3 shadow-2xs transition-colors hover:bg-muted/20"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <p className="truncate text-xs font-semibold text-foreground">{source.title}</p>
                          </div>
                          <Badge
                            variant={isPolicy ? 'default' : 'outline'}
                            className="shrink-0 text-[10px] px-1.5 py-0 h-4.5"
                          >
                            {isPolicy ? '정책' : '상품 문서'}
                          </Badge>
                        </div>
                        {preview ? (
                          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {preview}
                          </p>
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
