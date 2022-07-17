import { serve } from "https://deno.land/std@0.148.0/http/server.ts";
import { init } from "./index.ts";

init({
  dsn: "https://233a45e5efe34c47a3536797ce15dafa@o447951.ingest.sentry.io/5650507",
  debug: true,
});

function handler(_req: Request): Response {
  console.log("hello");
  some();
  return new Response("Hello, World!");
}

function some() {
  throw new Error("Some unhandled error");
}

serve(handler);
