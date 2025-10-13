import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth";
import { cvRoutes } from "./routes/cvs";
import { jobRoutes } from "./routes/jobs";
import { applicationRoutes } from "./routes/applications";
import { customCvRoutes } from "./routes/custom-cvs";
import { workflowRoutes } from "./routes/workflow";

type Job = Record<string, unknown>;
type ClientMeta = { filters?: Record<string, unknown> };

// In-memory websocket client registry
const clients = new Set<any>();
const clientMeta = new WeakMap<any, ClientMeta>();

export const app = new Elysia()
  .use(
    cors({
      origin: (request: Request) => {
        const requestOrigin = request.headers.get("origin");
        if (!requestOrigin) return false;
        if (env.ALLOWED_ORIGINS.includes("*")) return true;
        return env.ALLOWED_ORIGINS.includes(requestOrigin);
      },
      credentials: true,
    })
  )
  .use(authRoutes)
  .use(cvRoutes)
  .use(jobRoutes)
  .use(applicationRoutes)
  .use(customCvRoutes)
  .use(workflowRoutes)
  .get("/api/v1/system/health", () => ({ status: "ok" }))
  .ws("/ws", {
    open(ws) {
      clients.add(ws.raw);
      clientMeta.set(ws.raw, {});
      try {
        ws.send(
          JSON.stringify({
            type: "connected",
            message: "Ready to receive job updates",
          })
        );
      } catch {}
    },
    message(ws, message) {
      try {
        const data = JSON.parse(String(message)) as {
          type?: string;
          filters?: Record<string, unknown>;
        };
        if (data?.type === "subscribe") {
          const meta = clientMeta.get(ws.raw) ?? {};
          meta.filters = data.filters ?? {};
          clientMeta.set(ws.raw, meta);
          ws.send(
            JSON.stringify({ type: "subscribed", filters: meta.filters })
          );
          return;
        }
        // fallback echo for smoke
        ws.send(JSON.stringify({ type: "echo", message }));
      } catch {}
    },
    close(ws) {
      clients.delete(ws.raw);
      clientMeta.delete(ws.raw);
    },
  })
  .post(
    "/api/v1/jobs/broadcast",
    ({ headers, body, set }) => {
      const secret =
        headers["x-core-secret"] ?? headers["x-orchestrator-secret"];
      if (!secret || secret !== env.ORCHESTRATOR_SECRET) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const data = body as { jobs?: Job[]; stats?: Record<string, unknown> };
      const jobs = data.jobs ?? [];
      const stats = data.stats ?? {};

      let delivered = 0;
      for (const client of clients) {
        try {
          const filters = clientMeta.get(client)?.filters ?? {};
          const filteredJobs = filterJobsByUserPreferences(jobs, filters);
          if (filteredJobs.length === 0) continue;
          const payload = JSON.stringify({
            type: "new_jobs",
            jobs: filteredJobs,
            stats,
          });
          client.send(payload);
          delivered++;
        } catch {}
      }
      return { ok: true, delivered };
    },
    {
      body: t.Object({
        jobs: t.Array(t.Any(), { default: [] }),
        stats: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }
  );

function filterJobsByUserPreferences(
  jobs: Job[],
  filters: Record<string, unknown>
): Job[] {
  if (!filters || Object.keys(filters).length === 0) return jobs;
  return jobs.filter((job) => {
    // Simple matching on a few well-known fields; extend as needed
    const text = String(filters["text"] ?? "").toLowerCase();
    const area = filters["area"];
    const experience = filters["experience"];
    const schedule = filters["schedule"];

    const title = String((job as any).title ?? "").toLowerCase();
    const company = String((job as any).company ?? "").toLowerCase();
    const jobArea = String((job as any).area ?? "");
    const jobSchedule = String((job as any).schedule ?? "");

    const textOk = text ? title.includes(text) || company.includes(text) : true;
    const areaOk = area ? jobArea === area : true;
    const scheduleOk = schedule ? jobSchedule === schedule : true;
    const expOk = experience ? true : true; // placeholder; HH experience mapping varies
    return textOk && areaOk && scheduleOk && expOk;
  });
}
