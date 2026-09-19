"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getToken, me, UserOut } from "@/lib/api";

/** Client-side guard: no token → /login; token → verify via /me. */
export default function AuthGuard({
  children,
}: {
  children: (user: UserOut) => ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    me()
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  return <>{children(user)}</>;
}
