/**
 * Compatibility layer that exposes a react-router-dom-like API on top of
 * TanStack Router, so pages imported from the original app keep working.
 */
import { forwardRef, useEffect, type AnchorHTMLAttributes } from "react";
import {
  Link as TanstackLink,
  useNavigate as useTanstackNavigate,
  useLocation as useTanstackLocation,
  useParams as useTanstackParams,
  useRouter,
} from "@tanstack/react-router";

function splitPath(to: string) {
  const [pathAndSearch, hash] = to.split("#");
  const [pathname, searchStr] = pathAndSearch.split("?");
  const search: Record<string, string> = {};
  if (searchStr) {
    new URLSearchParams(searchStr).forEach((value, key) => {
      search[key] = value;
    });
  }
  return {
    to: pathname || "/",
    search,
    hash: hash ? hash : undefined,
  };
}

export function useNavigate() {
  const navigate = useTanstackNavigate();
  const router = useRouter();

  return (to: string | number, options?: { replace?: boolean; state?: unknown }) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") window.history.go(to);
      return;
    }
    if (/^https?:\/\//.test(to)) {
      if (typeof window !== "undefined") window.location.href = to;
      return;
    }
    const parsed = splitPath(to);
    void router; // keep router referenced for stable behavior across versions
    navigate({
      to: parsed.to,
      search: parsed.search,
      hash: parsed.hash,
      replace: options?.replace,
      state: (options?.state ?? undefined) as never,
    } as never);
  };
}

export function useLocation() {
  const location = useTanstackLocation();
  return {
    pathname: location.pathname,
    search: location.searchStr ? `?${location.searchStr.replace(/^\?/, "")}` : "",
    hash: location.hash ? `#${location.hash.replace(/^#/, "")}` : "",
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    state: (location.state ?? {}) as any,
    key: location.href,
  };
}

export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void,
] {
  const location = useTanstackLocation();
  const navigate = useTanstackNavigate();
  const params = new URLSearchParams(location.searchStr ?? "");

  const setParams = (
    next: URLSearchParams | Record<string, string>,
    options?: { replace?: boolean },
  ) => {
    const search: Record<string, string> = {};
    if (next instanceof URLSearchParams) {
      next.forEach((value, key) => {
        search[key] = value;
      });
    } else {
      Object.assign(search, next);
    }
    navigate({ to: location.pathname, search, replace: options?.replace } as never);
  };

  return [params, setParams];
}

export function useParams<T = Record<string, string>>(): T {
  return useTanstackParams({ strict: false } as never) as T;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, ...rest },
  ref,
) {
  if (/^(https?:|mailto:|tel:)/.test(to)) {
    return <a ref={ref} href={to} {...rest} />;
  }
  const parsed = splitPath(to);
  return (
    <TanstackLink
      ref={ref}
      to={parsed.to}
      search={parsed.search as never}
      hash={parsed.hash}
      replace={replace}
      state={state as never}
      {...(rest as Record<string, unknown>)}
    />
  );
});

export function Navigate({
  to,
  replace = true,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [to, replace, navigate]);
  return null;
}

export const NavLink = Link;
