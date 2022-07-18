import { init } from "./index.ts";

init({
  dsn:
    "https://233a45e5efe34c47a3536797ce15dafa@o447951.ingest.sentry.io/5650507",
  debug: true,
});

function some() {
  throw new Error("Some unhandled error");
}

setTimeout(() => {
  some();
}, 1000);
