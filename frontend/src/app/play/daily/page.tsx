import type { Metadata } from "next";

import { DailyGame } from "@/components/DailyGame";

export const metadata: Metadata = { title: "Daily challenge · Footlas" };

export default function DailyPage() {
  return <DailyGame />;
}
