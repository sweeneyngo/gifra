import { listSongs } from "@/lib/music";
import { MusicPlayer } from "./MusicPlayer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Music — gifra",
  description: "A library of vocal-synth covers.",
};

export default async function MusicPage() {
  const songs = await listSongs();
  return <MusicPlayer songs={songs} />;
}
