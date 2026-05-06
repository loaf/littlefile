import { processText } from './engine';

interface WorkerMessage {
  id: string;
  content: string;
  encoding: string;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, content, encoding } = e.data;
  try {
    const startTime = performance.now();
    const isLargeFile = content.length > 1_000_000;

    if (isLargeFile) {
      const firstChunk = content.slice(0, 1_000_000);
      const firstResult = processText(firstChunk, encoding);

      self.postMessage({
        id,
        type: 'first-chunk',
        book: firstResult,
        progress: {
          processed: 1_000_000,
          total: content.length,
          percent: Math.round((1_000_000 / content.length) * 100),
        },
      });
    }

    const book = processText(content, encoding);
    const elapsed = performance.now() - startTime;

    self.postMessage({
      id,
      type: 'complete',
      book,
      elapsed,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
