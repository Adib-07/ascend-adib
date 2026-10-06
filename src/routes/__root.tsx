import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ensureOwnerSession, subscribeOwnerSession } from "@/lib/owner-session";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">This page wandered off.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const err = error instanceof Error ? error : new Error(String(error));
  useEffect(() => {
    reportLovableError(err, { boundary: "tanstack_root_error_component" });
  }, [err]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-primary">Something went sideways</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again, or head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ascend — Build the life you're working toward" },
      {
        name: "description",
        content: "A quiet, elegant productivity studio for students and freelancers.",
      },
      { name: "theme-color", content: "#2F4F3E" },
      { name: "application-name", content: "Ascend" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Ascend" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Ascend — Build the life you're working toward" },
      { name: "twitter:title", content: "Ascend — Build the life you're working toward" },
      {
        property: "og:description",
        content: "A quiet, elegant productivity studio for students and freelancers.",
      },
      {
        name: "twitter:description",
        content: "A quiet, elegant productivity studio for students and freelancers.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/cd78633b-e0e2-4638-ba3b-76530f07fb92",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/cd78633b-e0e2-4638-ba3b-76530f07fb92",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png", sizes: "192x192" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [sessionState, setSessionState] = useState<"pending" | "ready" | "failed">("pending");
  const [failure, setFailure] = useState<"unavailable" | "credentials" | null>(null);

  useEffect(() => {
    let active = true;

    const classify = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("OWNER_SESSION_not_configured")) return "credentials";
      if (
        message.includes("OWNER_SESSION_invalid_credentials") ||
        message.includes("OWNER_SESSION_owner_mismatch")
      ) {
        return "credentials";
      }
      return "unavailable";
    };

    const establish = () => {
      if (!active) return;
      ensureOwnerSession()
        .then(() => {
          if (!active) return;
          setSessionState("ready");
          void queryClient.invalidateQueries();
        })
        .catch((err: unknown) => {
          if (!active) return;
          // Fail closed: no session means no data, never a bypass.
          reportLovableError(err instanceof Error ? err : new Error(String(err)), {
            boundary: "owner_session_bootstrap",
          });
          setFailure(classify(err));
          setSessionState("failed");
        });
    };

    void queryClient.cancelQueries();
    establish();
    // Restore the session if it is cleared or rotated while the tab is open.
    const unsubscribe = subscribeOwnerSession(establish);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  if (sessionState === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (sessionState === "failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-primary">Ascend is not ready</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {failure === "credentials"
              ? "Ascend could not establish the private owner session. Check OWNER_REFRESH_TOKEN on this host."
              : "Ascend is temporarily unable to connect to its data service."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ascend is available only on your private network.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
