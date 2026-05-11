import { Container, getContainer } from "@cloudflare/containers";

export class BackendContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

interface Env {
  BACKEND: DurableObjectNamespace<BackendContainer>;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    // Workers route binds this Worker only to /api/*, so we route everything
    // we receive into the singleton container instance. A single instance keeps
    // server.py's rasterio LRU + overlay caches warm across requests.
    return getContainer(env.BACKEND).fetch(request);
  },
} satisfies ExportedHandler<Env>;
