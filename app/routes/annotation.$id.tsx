import {
  LoaderFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { annotationAPI } from "~/api";
import Graph from "../components/graph";
import { Annotation, useRunQuery } from "./annotations";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import Bar from "~/components/bar.client";
import Markdown from "react-markdown";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { QueryBuilder, QueryBuilderProps } from "@yisehak-awm/query-builder";
import { ReactFlowProvider } from "@xyflow/react";
import { io, Socket } from "socket.io-client";
import Progress from "~/components/progress";
import empty from "/empty-result.svg";
import ErrorBoundaryContent from "~/components/error-boundary";

interface Update {
  status: "COMPLETE" | "PENDING" | "FAILED";
  update: any;
}

export const loader: LoaderFunction = async (props: LoaderFunctionArgs) => {
  return (await annotationAPI.get(`annotation/${props.params.id}`, {})).data;
};

export default function () {
  const data: Annotation = useLoaderData<typeof loader>();
  const [annotation, setAnnotation] = useState(data);
  const { nodes, edges } = annotation;
  const [filters, setFilteredTerms] = useState<string[]>([]);
  const [summaryShown, setShowSummary] = useState(false);
  const { runQuery, busy } = useRunQuery(annotation?.annotation_id);
  const [tab, setTab] = useState("result");
  const { revalidate, state } = useRevalidator();
  const ws = useRef<Socket>();

  useEffect(() => {
    setAnnotation(data);
    setTab("result");
  }, [data]);

  function handleUpdates(update: Update) {
    if (update.update.graph && state === "idle") {
      return revalidate();
    }
    if (update.status === "COMPLETE" || update.status === "FAILED")
      ws.current?.close();
    setAnnotation((a) => ({ ...a, ...update.update, status: update.status }));
  }

  useEffect(() => {
    if (data.status !== "PENDING") return () => {};
    const socketUrl = window.ENV?.ANNOTATION_URL;
    if (!socketUrl) return () => {};
    ws.current = io(socketUrl);
    ws.current.on("connect", () => {
      ws.current!.emit("join", { room: data.annotation_id });
    });
    ws.current.on("update", handleUpdates);
    return () => {
      ws.current?.close();
    };
  }, [data]);

  const queryNodes: QueryBuilderProps["nodes"] = useMemo(() => {
    return (
      annotation?.request.nodes.map((n) => ({
        id: n.node_id,
        type: "custom",
        data: {
          id: n.id,
          qb_node_type: n.type,
          ...n.properties,
        },
        position: { x: 0, y: 0 },
      })) || []
    );
  }, [annotation]);

  const queryEdges: QueryBuilderProps["edges"] = useMemo(() => {
    return (
      annotation?.request.predicates.map((e) => ({
        id: e.source + e.type + e.target,
        type: "custom",
        source: e.source,
        target: e.target,
        data: {
          edgeType: e.type,
          options: [],
        },
      })) || []
    );
  }, [annotation]);

  const colorMapping = useMemo(() => {
    if (!nodes) return;
    const uniqueNodeTypes = new Set(nodes.map((n) => n.data.type));
    const map = [
      "#EF4444",
      "#22C55E",
      "#F97316",
      "#3B82F6",
      "#EAB308",
      "#8B5CF6",
      "#84CC16",
      "#EC4899",
      "#14B8A6",
      "#6366F1",
      "#06B6D4",
      "#F472B6",
      "#0EA5E9",
      "#A855F7",
      "#6B7280",
    ];
    return [...uniqueNodeTypes].reduce(
      (a, c, i) => ({ ...a, [c]: map[i] }),
      {}
    );
  }, [annotation]);

  const onFilterChange = useCallback(
    (item: string) =>
      setFilteredTerms((items) => {
        return items.includes(item)
          ? items.filter((i) => i !== item)
          : [...items, item];
      }),
    []
  );

  if (annotation.status === "PENDING" && !annotation.nodes) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div>
          <h2 className="mb-4">Generating annotation result ...</h2>
          <Progress />
        </div>
      </div>
    );
  }

  if (annotation.status === "FAILED" && !annotation.nodes) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-destructive">
          <AlertTriangle className="me-4 inline" /> Result could not be
          generated.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 left-12 z-50 ">
        <div className="flex items-center rounded-lg p-2 bg-background/75">
          <ArrowLeft size={24} className="inline me-4" />
          <h2 className="text-xl font-bold">{annotation.title}</h2>
        </div>
        <Tabs value={tab} className="mt-2" onValueChange={setTab}>
          <TabsList className="min-w-[200px]">
            <TabsTrigger value="query">Query</TabsTrigger>
            <TabsTrigger value="result">Result</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab == "query" && (
        <ReactFlowProvider>
          <QueryBuilder
            busy={busy}
            onSubmit={async (query) => {
              await runQuery(query);
              if (state === "idle") revalidate();
            }}
            nodes={queryNodes}
            edges={queryEdges}
            previouslyRun={true}
          />
        </ReactFlowProvider>
      )}
      {tab == "result" &&
        (!annotation.nodes?.length ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-1/3 flex-col items-center">
              <img src={empty} className="h-72 w-72 dark:invert-[0.95]" />
              <h2 className="mb-4 text-xl font-bold text-foreground/70">
                No matching results
              </h2>
              <p className="mb-8 text-center text-foreground/50">
                Your query did not return any matching results. Please modify
                the query and re-run it.
              </p>
            </div>
          </div>
        ) : (
          <>
            <Graph
              elements={{ nodes, edges }}
              filters={filters}
              colorMapping={colorMapping}
            >
              <div className="ms-4 flex rounded-full border bg-background/60 p-1 px-6">
                <Tooltip>
                  <TooltipTrigger className="p-0" asChild>
                    <Button
                      size="icon"
                      variant="link"
                      onClick={() => setShowSummary(true)}
                    >
                      <BookOpenText className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Graph description</TooltipContent>
                </Tooltip>
              </div>
            </Graph>
            <ResultSummary
              open={summaryShown}
              onOpenChange={setShowSummary}
              summary={annotation.summary}
              nodeTypeCounts={annotation.node_count_by_label}
              edgeTypeCounts={annotation.edge_count_by_label}
              status={annotation.status}
            />
            <Legend
              filters={filters}
              onFilterToggle={onFilterChange}
              nodeTypeCounts={annotation.node_count_by_label}
              edgeTypeCounts={annotation.edge_count_by_label}
              totalEdgeCount={annotation.edge_count}
              totalNodeCount={annotation.node_count}
              status={annotation.status}
              colorMapping={colorMapping || {}}
            />
          </>
        ))}
    </div>
  );
}

interface LegendProps {
  filters: string[];
  onFilterToggle: (filter: string) => void;
  nodeTypeCounts: { label: string; count: number }[];
  edgeTypeCounts: { label: string; count: number }[];
  totalEdgeCount: number;
  totalNodeCount: number;
  status: Annotation["status"];
  colorMapping: any;
}

function Legend(props: LegendProps) {
  if (props.totalNodeCount && props.nodeTypeCounts && props.colorMapping)
    return (
      <div className="absolute right-4 top-4">
        <div className="rounded-lg bg-background/75 p-4 pt-0">
          <Accordion
            type="multiple"
            className="min-w-36"
            defaultValue={["nodes"]}
          >
            <AccordionItem value="nodes" className="border-0 p-0">
              <AccordionTrigger>
                <span className="font-mono text-xs font-bold">
                  Nodes ({props.totalNodeCount})
                </span>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <ul>
                  {props.nodeTypeCounts.map((n: any) => (
                    <li
                      key={n.label}
                      className={`mb-1 flex select-none items-center text-sm hover:cursor-pointer ${
                        props.filters.includes(n.label) &&
                        "line-through opacity-50"
                      }`}
                      onClick={() => props.onFilterToggle(n.label)}
                    >
                      <div
                        className="me-1 h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            props.colorMapping[
                              n.label as keyof typeof props.colorMapping
                            ],
                        }}
                      ></div>{" "}
                      {n.label} ({n.count})
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="edges" className="border-0 p-0">
              <AccordionTrigger>
                <span className="font-mono text-xs font-bold">
                  Edges ({props.totalEdgeCount})
                </span>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <ul>
                  {props.edgeTypeCounts.map((e: any) => (
                    <li
                      key={e.label}
                      className={`mb-1 flex select-none items-center text-sm hover:cursor-pointer ${
                        props.filters.includes(e.label) &&
                        "line-through opacity-50"
                      }`}
                      onClick={() => props.onFilterToggle(e.label)}
                    >
                      <div className="me-1 h-3 w-3 rounded-full bg-border"></div>{" "}
                      {e.label} ({e.count})
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    );

  if (props.status === "PENDING") {
    return (
      <div className="absolute right-4 top-4">
        <p className="top-1/2 text-sm text-foreground/50">
          Generating legend ...
        </p>
        <Skeleton className="h-12 w-[250px]" />
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-4">
      <p className="top-1/2 text-sm text-destructive">
        <TriangleAlert size={16} className="me-2 inline" /> Failed to generate
        legend.
      </p>
    </div>
  );
}

interface ResultSummaryProps {
  summary: string;
  nodeTypeCounts: { label: string; count: number }[];
  edgeTypeCounts: { label: string; count: number }[];
  status: Annotation["status"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ResultSummary(props: ResultSummaryProps) {
  const components = {
    h3: ({ node, ...props }: any) => (
      <h3 className="font-bold my-2" {...props} />
    ),
    p: ({ node, ...props }: any) => <p className="mb-6" {...props} />,
  };
  if (props.summary && props.nodeTypeCounts)
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="left"
          className="min-w-[900px] overflow-y-auto px-12 pb-12"
        >
          <SheetHeader>
            <SheetTitle className="font-bold">Summary</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <Markdown components={components}>{props.summary}</Markdown>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4">
            <div>
              <h2 className="mb-4 font-bold">Node count</h2>
              <Bar
                data={props.nodeTypeCounts.map((a) => a.count)}
                categories={props.nodeTypeCounts.map((a) => a.label)}
              />
            </div>
            <div>
              <h2 className="mb-4 font-bold">Edge count</h2>
              <Bar
                data={props.edgeTypeCounts.map((a) => a.count)}
                categories={props.edgeTypeCounts.map((a) => a.label)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );

  if (props.status === "PENDING") {
    return (
      <div className="flex items-center">
        <Skeleton className="me-2 ms-4 h-10 w-16 rounded-full" />
        <p className="top-1/2 text-sm text-foreground/50">
          Generating AI summary ...
        </p>
      </div>
    );
  }

  return (
    <p className="p-4 text-sm text-destructive">
      <TriangleAlert size={16} className="inline" /> Failed to generate AI
      summary.
    </p>
  );
}

export const meta: MetaFunction = () => {
  return [{ title: "Generic annotation - Annotation result" }];
};

export function ErrorBoundary() {
  return <ErrorBoundaryContent />;
}
