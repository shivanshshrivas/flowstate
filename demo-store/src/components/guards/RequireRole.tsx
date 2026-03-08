"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user-store";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@shivanshshrivas/flowstate";

interface Props {
  roles: UserRole[];
  children: React.ReactNode;
  redirect?: boolean;
}

export function RequireRole({ roles, children, redirect = true }: Props) {
  const { user, isLoading } = useUserStore();
  const router = useRouter();

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAccess =
    !supabaseConfigured || (!!user && roles.includes(user.role));

  useEffect(() => {
    if (supabaseConfigured && !isLoading && !hasAccess && redirect) {
      if (user) {
        router.replace(user.role === "seller" ? "/seller" : "/");
      } else {
        router.replace("/auth/login");
      }
    }
  }, [isLoading, hasAccess, supabaseConfigured, redirect, user, router]);

  // No Supabase configured — render in demo mode
  if (!supabaseConfigured) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-neutral-400 text-lg">
          {user
            ? "You don't have access to this page."
            : "Please sign in to continue."}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
