"use client";

import * as React from "react";
import { Suspense, useEffect, useRef, RefObject, useCallback } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { HeroUIProvider } from "@heroui/react";

import type { SessionValidationResult } from "@/types";
import { useSessionStore } from "@/state/session";
import { useConfigStore } from "@/state/config";
import type { getConfig } from "@/flags";

import { EmailVerificationDialog } from "./email-verification-dialog";
import { useTopLoader } from "nextjs-toploader";
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation";
import { useEventListener, useDebounceCallback } from "usehooks-ts";

function RouterChecker() {
  const { start, done } = useTopLoader();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const fetchSession = useSessionStore((s) => s.fetchSession);

  useEffect(() => {
    const _push = router.push.bind(router);
    const _refresh = router.refresh.bind(router);

    router.push = (href, options) => {
      start();
      _push(href, options);
    };

    router.refresh = () => {
      start();
      fetchSession?.();
      _refresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    done();
    fetchSession?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, params]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const setSession = useSessionStore((s) => s.setSession);
  const setConfig = useConfigStore((s) => s.setConfig);
  const refetchSession = useSessionStore((s) => s.refetchSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  const documentRef = useRef<typeof document | null>(typeof window === "undefined" ? null : document);

  const doFetchSession = useCallback(async () => {
    try {
      refetchSession();
      const response = await fetch("/api/get-session", { credentials: "include" });
      const sessionWithConfig = (await response.json()) as {
        session: SessionValidationResult;
        config: Awaited<ReturnType<typeof getConfig>>;
      };

      setConfig(sessionWithConfig?.config);

      if (sessionWithConfig?.session) {
        setSession(sessionWithConfig.session);
      } else {
        clearSession();
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      clearSession();
    }
  }, [setSession, setConfig, clearSession, refetchSession]);

  const fetchSession = useDebounceCallback(doFetchSession, 30);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "visible") {
        fetchSession();
      }
    },
    documentRef as RefObject<Document>
  );

  // ohne windowRef: defaultet auf window (kein ts-ignore mehr)
  useEventListener("focus", () => { fetchSession(); });

  useEffect(() => {
    useSessionStore.setState({ fetchSession: doFetchSession });
  }, [doFetchSession]);

  return (
    <HeroUIProvider>
      <Suspense>
        <RouterChecker />
      </Suspense>
      <NextThemesProvider {...props} attribute="class" defaultTheme="dark" enableSystem>
        {children}
        <EmailVerificationDialog />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
