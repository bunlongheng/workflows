'use client';

import { useState, useEffect, useCallback } from 'react';

interface LikedVideo {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;
  views: string;
  description: string;
}

interface ActivityFeedProps {
  onClose: () => void;
}

export default function ActivityFeed({ onClose }: ActivityFeedProps) {
  const [videos, setVideos] = useState<LikedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [unliking, setUnliking] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  const fetchLikes = useCallback(async (pageToken?: string) => {
    if (pageToken) setLoadingMore(true);
    else setLoading(true);

    try {
      const url = pageToken
        ? `/api/youtube/likes?pageToken=${pageToken}&maxResults=20`
        : '/api/youtube/likes?maxResults=20';
      const res = await fetch(url);
      const data = await res.json();

      if (data.videos) {
        setVideos((prev) => pageToken ? [...prev, ...data.videos] : data.videos);
        setNextPageToken(data.nextPageToken);
        setTotalResults(data.totalResults);
      }
    } catch {}

    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  async function handleUnlike(videoId: string) {
    setUnliking(videoId);
    try {
      const res = await fetch('/api/youtube/unlike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.videoId !== videoId));
        setTotalResults((prev) => prev - 1);
      }
    } catch {}
    setUnliking(null);
  }

  async function handleProcess(videoId: string) {
    setProcessing(videoId);
    try {
      const res = await fetch('/api/youtube/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        setProcessedIds((prev) => new Set([...prev, videoId]));
      }
    } catch {}
    setProcessing(null);
  }

  function formatViews(views: string): string {
    const n = parseInt(views);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return views;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-[680px]"
        style={{
          maxHeight: '90vh',
          background: '#141414',
          border: '1px solid #252525',
          boxShadow: '0 40px 120px rgba(0,0,0,0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #222' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center">
              <img src="/icons/youtube.svg" alt="" style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f0f0f0]">Liked Videos</h2>
              <p className="text-[11px] text-[#555]">
                {totalResults > 0 ? `${totalResults} videos` : 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-[#ccc] transition-colors border border-[#2a2a2a]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-[#444] text-sm">Loading your liked videos...</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#444] text-sm">No liked videos found</p>
              <p className="text-[#333] text-xs mt-1">Connect YouTube and like some videos</p>
            </div>
          ) : (
            <>
              {videos.map((video) => (
                <div
                  key={video.videoId}
                  className="px-3 sm:px-5 py-3 hover:bg-[#1a1a1a] transition-colors"
                  style={{ borderBottom: '1px solid #1e1e1e' }}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 relative hidden sm:block"
                    >
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="rounded-lg"
                        style={{ width: '140px', height: '79px', objectFit: 'cover' }}
                      />
                    </a>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={`https://youtube.com/watch?v=${video.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-semibold text-[#f0f0f0] hover:text-indigo-400 transition-colors line-clamp-2 leading-snug"
                        >
                          {video.title}
                        </a>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Process button */}
                          {processedIds.has(video.videoId) ? (
                            <span className="text-[10px] text-green-400 px-2 py-1">Saved</span>
                          ) : (
                            <button
                              onClick={() => handleProcess(video.videoId)}
                              disabled={processing === video.videoId}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                              title="Transcribe + Summarize + Save to Stickies"
                            >
                              {processing === video.videoId ? '...' : 'Process'}
                            </button>
                          )}

                          {/* Unlike button */}
                          <button
                            onClick={() => handleUnlike(video.videoId)}
                            disabled={unliking === video.videoId}
                            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
                            title="Unlike on YouTube"
                          >
                            {unliking === video.videoId ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hover:opacity-60">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#555] mt-0.5">{video.channel}</p>
                      <p className="text-[10px] text-[#444] mt-0.5">
                        {formatViews(video.views)} views
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load more */}
              {nextPageToken && (
                <div className="px-4 sm:px-6 py-4 text-center">
                  <button
                    onClick={() => fetchLikes(nextPageToken)}
                    disabled={loadingMore}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #1e1e1e' }}>
          <p className="text-[11px] text-[#333]">{videos.length} of {totalResults} liked videos</p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#888] hover:text-[#ccc] bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
