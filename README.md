# `sentry-deno`

Experimental Sentry client for Deno

```ts
import { init } from 'https://cdn.jsdelivr.net/gh/timfish/sentry-deno@master/mod.ts';

init({
  dsn: '__YOUR_DSN__',
});

throw new Error('Something happened');
```

You will need to run Deno with `--allow-net` to allow events to be sent to
Sentry. If you also run with `--allow-read` and allow access your source files,
source code will be included in stacktraces.

### Issues

- Deno added support for catching `unhandledrejection` in v1.24

### Further improvements

- Add wrappers for Deno std library features, (like `serve`) to instrument and
  catch errors?
