import type { Metadata } from "next";

import { PracticeGame } from "@/components/PracticeGame";

export const metadata: Metadata = { title: "Who Am I? · Footlas" };

export default function PlayersPage() {
  return <PracticeGame mode="player" title="Who Am I?" />;
}
