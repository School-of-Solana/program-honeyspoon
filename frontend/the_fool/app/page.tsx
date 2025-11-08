import KaplayGame from "@/components/KaplayGame";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold">KAPLAY Game</h1>
        <KaplayGame />
      </main>
    </div>
  );
}
