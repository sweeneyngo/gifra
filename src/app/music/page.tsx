import { listSongs } from "@/lib/music";
import { MusicLibrary } from "./MusicLibrary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Music",
  description: "A library of vocal-synth covers.",
};

export default async function MusicPage() {
  const songs = await listSongs();
  return <MusicLibrary songs={songs} />;
}
