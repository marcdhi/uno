"use server";

import { signOut } from "@/app/(auth)/auth";

export async function handleSignOut() {
  await signOut({
    redirectTo: "/",
  });
} 