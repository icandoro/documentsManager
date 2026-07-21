import type { LucideIcon } from "lucide-react";

export type SeedDocument = {
  id: number;
  title: string;
  type: string;
  status: string;
  size: string;
  icon?: LucideIcon;
};

export const documents: SeedDocument[] = [];

export const receivedPackages = [];

export const sentPackages = [];
