'use client';

import { useParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { useBoard } from '@/lib/hooks/useBoard';
import { Board } from '@/components/Board';

export default function BoardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { sessionId, loading: sessionLoading } = useSession();
  const { pins, hiddenPins, boardLocation, loading: boardLoading, refreshBoard } = useBoard(slug, sessionId);

  if (sessionLoading || boardLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-muted font-mono">loading...</p>
      </div>
    );
  }

  if (!boardLocation) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted font-mono mb-4">board not found</p>
          <a href="/" className="btn">go home</a>
        </div>
      </div>
    );
  }

  return (
    <Board
      location={boardLocation}
      pins={pins}
      hiddenPins={hiddenPins}
      sessionId={sessionId}
      onRefresh={refreshBoard}
    />
  );
}
