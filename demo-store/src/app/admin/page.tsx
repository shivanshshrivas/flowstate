"use client";

import { AdminDashboard } from "@shivanshshrivas/flowstate";
import { RequireRole } from "@/components/guards/RequireRole";

const PROJECT_ID = process.env.NEXT_PUBLIC_FLOWSTATE_PROJECT_ID ?? "demo";

export default function AdminDashboardPage() {
  return (
    <RequireRole roles={["admin"]}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminDashboard projectId={PROJECT_ID} />
      </div>
    </RequireRole>
  );
}
