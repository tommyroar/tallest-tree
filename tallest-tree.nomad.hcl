job "tallest-tree" {
  datacenters = ["dc1"]
  type        = "service"

  meta {
    project       = "tallest-tree"
    url_tailscale = "https://tommys-mac-mini.tail59a169.ts.net/tallest-trees"
    url_local     = "http://tommys-mac-mini.local:5180"
    url_localhost  = "http://127.0.0.1:5180"
    url_backend   = "http://127.0.0.1:5111"
    repo          = "tommyroar/tallest-tree"
  }

  group "backend" {
    count = 1

    network {
      port "flask" {
        static = 5111
      }
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "10s"
      mode     = "delay"
    }

    task "flask-server" {
      driver = "raw_exec"

      env {
        PATH = "/Users/tommydoerr/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        HOME = "/Users/tommydoerr"
      }

      config {
        command = "/bin/bash"
        args = [
          "-c",
          "cd /Users/tommydoerr/dev/tallest-tree && exec .venv/bin/python server.py",
        ]
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }

    task "flask-health" {
      driver = "raw_exec"

      lifecycle {
        hook    = "poststart"
        sidecar = true
      }

      env {
        PATH = "/Users/tommydoerr/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
      }

      config {
        command = "/bin/bash"
        args = [
          "-c",
          <<-EOT
          # Wait for Flask to accept connections
          for i in $(seq 1 60); do
            if curl -sf http://127.0.0.1:5111/api/health >/dev/null 2>&1; then
              echo "Flask healthy"
              break
            fi
            echo "Waiting for Flask... ($i)"
            sleep 2
          done
          # Keep sidecar alive, periodically log health
          while true; do
            sleep 300
            curl -sf http://127.0.0.1:5111/api/health >/dev/null 2>&1 && echo "Flask healthy" || echo "Flask unhealthy"
          done
          EOT
        ]
      }

      resources {
        cpu    = 50
        memory = 32
      }
    }
  }

  group "frontend" {
    count = 1

    network {
      port "vite" {
        static = 5180
      }
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "10s"
      mode     = "delay"
    }

    task "vite-server" {
      driver = "raw_exec"

      env {
        PATH = "/Users/tommydoerr/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        HOME = "/Users/tommydoerr"
      }

      config {
        command = "/bin/bash"
        args = [
          "-c",
          "cd /Users/tommydoerr/dev/tallest-tree && exec npx vite --host 0.0.0.0 --port 5180",
        ]
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "tailscale-serve" {
      driver = "raw_exec"

      lifecycle {
        hook    = "poststart"
        sidecar = true
      }

      env {
        PATH = "/Users/tommydoerr/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        HOME = "/Users/tommydoerr"
      }

      config {
        command = "/bin/bash"
        args = [
          "-c",
          <<-EOT
          # Wait for Vite to be ready
          for i in $(seq 1 30); do
            curl -sk -o /dev/null http://localhost:5180/ 2>/dev/null && break
            sleep 1
          done
          # Set up Tailscale Serve and block
          tailscale serve --bg --set-path /tallest-trees https+insecure://localhost:5180
          exec tail -f /dev/null
          EOT
        ]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }
}
