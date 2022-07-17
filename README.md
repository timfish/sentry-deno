# `sentry-deno`

Experimental Sentry client for Deno

```ts
import { init } from "https://cdn.jsdelivr.net/gh/timfish/sentry-deno@master/index.ts";

init({
    dsn: "__YOUR_DSN__"
});

throw new Error("Something happened");
```