"use client";

import { useMemo } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { useAuthState } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function useApi() {
  const { getHeaders } = useAuthState();
  return useMemo(() => {
    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers = {
        "Content-Type": "application/json",
        ...(await getHeaders()),
      };
      const res = await fetch(`${API_URL}${path}`, { ...init, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.detail ?? `Request failed (${res.status})`, res.status);
      }
      return res.json() as Promise<T>;
    }
    return {
      get: <T,>(path: string) => request<T>(path),
      post: <T,>(path: string, body: unknown) =>
        request<T>(path, { method: "POST", body: JSON.stringify(body) }),
      patch: <T,>(path: string, body: unknown) =>
        request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    };
  }, [getHeaders]);
}

/** SWR bound to the signed-in user. Pass null to skip fetching. */
export function useApiData<T>(path: string | null, config?: SWRConfiguration<T>) {
  const { signedIn, mode } = useAuthState();
  const api = useApi();
  return useSWR<T>(
    signedIn && path ? [mode, path] : null,
    ([, p]: [string, string]) => api.get<T>(p),
    config,
  );
}
