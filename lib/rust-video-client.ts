interface VideoProcessRequest {
  video_url: string;
  operation: string;
  parameters: Record<string, any>;
}

interface BatchProcessRequest {
  video_url: string;
  operations: Array<{
    type: string;
    parameters: Record<string, any>;
    order: number;
  }>;
}

interface ProcessResponse {
  success: boolean;
  video_url?: string;
  error?: string;
  processing_time_ms: number;
  operation: string;
}

interface HealthResponse {
  status: string;
  ffmpeg_available: boolean;
  version: string;
}

class RustVideoClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async processVideo(request: VideoProcessRequest): Promise<ProcessResponse> {
    const response = await fetch(`${this.baseUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Video processing failed: ${response.statusText}`);
    }

    return response.json();
  }

  async processBatch(request: BatchProcessRequest): Promise<ProcessResponse> {
    const response = await fetch(`${this.baseUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Batch processing failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Convenience methods for common operations
  async adjustBrightness(videoUrl: string, brightness: number): Promise<ProcessResponse> {
    return this.processVideo({
      video_url: videoUrl,
      operation: 'adjustBrightness',
      parameters: { brightness },
    });
  }

  async adjustSpeed(videoUrl: string, speed: number): Promise<ProcessResponse> {
    return this.processVideo({
      video_url: videoUrl,
      operation: 'adjustSpeed',
      parameters: { speed },
    });
  }

  async trimVideo(videoUrl: string, startTime: number, endTime?: number): Promise<ProcessResponse> {
    const parameters: Record<string, any> = { startTime };
    if (endTime !== undefined) {
      parameters.endTime = endTime;
    }

    return this.processVideo({
      video_url: videoUrl,
      operation: 'trimVideo',
      parameters,
    });
  }

  async cropVideo(videoUrl: string, x: number, y: number, width: number, height: number): Promise<ProcessResponse> {
    return this.processVideo({
      video_url: videoUrl,
      operation: 'cropVideo',
      parameters: { x, y, width, height },
    });
  }

  async addText(videoUrl: string, text: string, position: 'top' | 'center' | 'bottom' = 'center'): Promise<ProcessResponse> {
    return this.processVideo({
      video_url: videoUrl,
      operation: 'addText',
      parameters: { text, position },
    });
  }

  async applyFilter(videoUrl: string, filter: string): Promise<ProcessResponse> {
    return this.processVideo({
      video_url: videoUrl,
      operation: 'applyFilter',
      parameters: { filter },
    });
  }

  // Style presets
  async applyCinematicStyle(videoUrl: string): Promise<ProcessResponse> {
    return this.processBatch({
      video_url: videoUrl,
      operations: [
        { type: 'adjustBrightness', parameters: { brightness: 10 }, order: 1 },
        { type: 'applyFilter', parameters: { filter: 'cinematic' }, order: 2 },
      ],
    });
  }

  async applyVintageStyle(videoUrl: string): Promise<ProcessResponse> {
    return this.processBatch({
      video_url: videoUrl,
      operations: [
        { type: 'applyFilter', parameters: { filter: 'vintage' }, order: 1 },
        { type: 'adjustBrightness', parameters: { brightness: 5 }, order: 2 },
      ],
    });
  }
}

// Create a singleton instance
export const rustVideoClient = new RustVideoClient(
  process.env.RUST_VIDEO_SERVER_URL || 'http://localhost:3001'
);

export type { VideoProcessRequest, BatchProcessRequest, ProcessResponse, HealthResponse }; 