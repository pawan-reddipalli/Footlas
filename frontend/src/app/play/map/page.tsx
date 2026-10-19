import type { Metadata } from "next";

import { PracticeGame } from "@/components/PracticeGame";

export const metadata: Metadata = { title: "World Map · Footlas" };

export default function MapPage() {
  return <PracticeGame mode="map" title="World Map" />;
}
