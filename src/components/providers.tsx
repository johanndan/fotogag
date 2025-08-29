"use client";

import * as React from "react";
import { Suspense, useEffect, useRef, RefObject, useCallback } from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
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
}: ThemeProviderProps & { children: React.ReactNode }) {
  const setSession = useSessionStore((s) => s.setSession);
  const setConfig = useConfigStore((s) => s.setConfig);
  const refetchSession = useSessionStore((s) => s.refetchSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  const documentRef = useRef<typeof document | null>(typeof window === "undefined" ? null : document);
  const windowRef = useRef<typeof window | null>(typeof window === "undefined" ? null : window);

  const doFetchSession = useCallback(async () => {
    try {
      refetchSession(); // set loading state
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

  useEventListener(
    "focus",
    () => {
      fetchSession();
    },
    // @ts-expect-error window is not defined on server
    windowRef
  );

  useEffect(() => {
    useSessionStore.setState({ fetchSession: doFetchSession });
  }, [doFetchSession]);

  const mergedThemeProps: ThemeProviderProps = {
    attribute: "class",
    defaultTheme: "dark",
    enableSystem: true,
    ...props,
    scriptProps: {
      "data-cfasync": "false",
      ...(props.scriptProps ?? {}),
    },
  };

  return (
    <HeroUIProvider>
      <Suspense>
        <RouterChecker />
      </Suspense>
      <NextThemesProvider {...mergedThemeProps}>
        {children}
        <EmailVerificationDialog />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
