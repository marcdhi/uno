import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { generateUUID } from './utils';
import { put } from '@vercel/blob';
import os from 'os';

// FFmpeg setup with robust fallbacks and dynamic download
let ffmpegPath: string;

async function downloadFFmpeg(): Promise<string> {
  const platform = os.platform();
  const arch = os.arch();
  
  // For macOS, we can use evermeet.cx
  if (platform === 'darwin') {
    try {
      console.log('Downloading FFmpeg for macOS...');
      const downloadUrl = 'https://evermeet.cx/ffmpeg/get/zip';
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download FFmpeg');
      }
      
      const buffer = await response.arrayBuffer();
      const tempDir = path.join(os.tmpdir(), 'ffmpeg-download');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const zipPath = path.join(tempDir, 'ffmpeg.zip');
      fs.writeFileSync(zipPath, new Uint8Array(buffer));
      
      // Extract zip (simple approach)
      const { execSync } = require('child_process');
      execSync(`cd "${tempDir}" && unzip -o ffmpeg.zip`, { stdio: 'pipe' });
      
      const ffmpegBinary = path.join(tempDir, 'ffmpeg');
      if (fs.existsSync(ffmpegBinary)) {
        // Make executable
        fs.chmodSync(ffmpegBinary, 0o755);
        console.log('Downloaded and extracted FFmpeg to:', ffmpegBinary);
        return ffmpegBinary;
      }
    } catch (error) {
      console.log('Failed to download FFmpeg:', error);
    }
  }
  
  return 'ffmpeg'; // Fallback to system
}

function getFFmpegPath(): string {
  try {
    // Try to get ffmpeg-static path
    const staticPath = require('ffmpeg-static');
    console.log('Raw ffmpeg-static path:', staticPath);
    
    // Check if it's a webpack-bundled path
    if (staticPath && staticPath.includes('[project]')) {
      console.log('Detected webpack-bundled path, trying to resolve...');
      
      // Try to find the actual binary in node_modules
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.2.0', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'bin', 'ffmpeg'),
        path.join(process.cwd(), 'node_modules', '.pnpm', '@ffmpeg-installer+darwin-arm64@4.1.5', 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
      ];
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          console.log('Found ffmpeg binary at:', testPath);
          return testPath;
        }
      }
      
      // Try dynamic search for any ffmpeg binary in node_modules
      try {
        const { execSync } = require('child_process');
        const findResult = execSync('find node_modules -name ffmpeg -type f 2>/dev/null', { 
          cwd: process.cwd(),
          encoding: 'utf8' 
        });
        const binaries = findResult.trim().split('\n').filter(Boolean);
        
        if (binaries.length > 0) {
          const binaryPath = path.join(process.cwd(), binaries[0]);
          console.log('Found ffmpeg binary via search:', binaryPath);
          return binaryPath;
        }
      } catch (searchError) {
        console.log('Dynamic search failed:', searchError);
      }
      
      // If we can't find the binary, fall back to system ffmpeg
      console.log('Could not resolve ffmpeg-static binary, falling back to system ffmpeg');
      return 'ffmpeg';
    }
    
    // Check if the static path exists
    if (staticPath && fs.existsSync(staticPath)) {
      console.log('Using ffmpeg-static:', staticPath);
      return staticPath;
    }
    
    console.log('ffmpeg-static path does not exist, falling back to system ffmpeg');
    return 'ffmpeg';
    
  } catch (error) {
    console.log('ffmpeg-static not available, using system ffmpeg');
    return 'ffmpeg';
  }
}

// Initialize FFmpeg path
ffmpegPath = getFFmpegPath();

// Test if FFmpeg works, if not try to download it
async function ensureFFmpeg(): Promise<string> {
  if (ffmpegPath && ffmpegPath !== 'ffmpeg' && fs.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }
  
  // Test system FFmpeg
  if (ffmpegPath === 'ffmpeg') {
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('System FFmpeg is available');
      return ffmpegPath;
    } catch (error) {
      console.log('System FFmpeg not available, attempting download...');
      const downloadedPath = await downloadFFmpeg();
      ffmpegPath = downloadedPath;
      return downloadedPath;
    }
  }
  
  return ffmpegPath;
}

interface VideoProcessorOptions {
  tempDir?: string;
}

class VideoProcessor {
  private tempDir: string;

  constructor(options: VideoProcessorOptions = {}) {
    this.tempDir = options.tempDir || path.join(process.cwd(), 'tmp');
    this.ensureTempDir();
  }

  private ensureTempDir() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create temp directory:', error);
      // Fallback to system temp directory
      this.tempDir = require('os').tmpdir();
    }
  }

  private async downloadVideo(url: string): Promise<string> {
    const videoId = generateUUID();
    const tempPath = path.join(this.tempDir, `input_${videoId}.mp4`);
    
    // Download the video file from the URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download video');
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(tempPath, new Uint8Array(buffer));
    
    return tempPath;
  }

  private async runFFmpeg(args: string[]): Promise<string> {
    // Ensure FFmpeg is available before running
    const currentFFmpegPath = await ensureFFmpeg();
    
    return new Promise((resolve, reject) => {
      console.log('Running FFmpeg with path:', currentFFmpegPath);
      console.log('FFmpeg arguments:', args);
      
      // Check if ffmpeg path exists (for static binaries)
      if (currentFFmpegPath !== 'ffmpeg' && !fs.existsSync(currentFFmpegPath)) {
        reject(new Error(`FFmpeg binary not found at path: ${currentFFmpegPath}`));
        return;
      }
      
      const process = spawn(currentFFmpegPath, args);
      
      let stderr = '';
      let stdout = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        console.log('FFmpeg process finished with code:', code);
        console.log('FFmpeg stderr:', stderr);
        console.log('FFmpeg stdout:', stdout);
        
        if (code === 0) {
          resolve(stderr);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}. stderr: ${stderr}, stdout: ${stdout}`));
        }
      });
      
      process.on('error', (error) => {
        console.error('FFmpeg spawn error:', error);
        reject(new Error(`FFmpeg spawn error: ${error.message}. Path: ${currentFFmpegPath}`));
      });
    });
  }

  private generateOutputPath(): string {
    const outputId = generateUUID();
    return path.join(this.tempDir, `output_${outputId}.mp4`);
  }

  private async uploadToVercelBlob(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const fileName = `processed_${generateUUID()}.mp4`;
    
    const blob = await put(fileName, buffer, {
      access: 'public',
      contentType: 'video/mp4',
    });
    
    return blob.url;
  }

  async trimVideo(videoUrl: string, startTime: number, endTime: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', (endTime - startTime).toString(),
      '-c', 'copy',
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    // Upload the processed video and return URL
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    // Clean up temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async adjustSpeed(videoUrl: string, speed: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    const videoSpeed = 1 / speed; // FFmpeg uses inverse for video speed
    const audioSpeed = speed;
    
    const args = [
      '-i', inputPath,
      '-filter_complex', `[0:v]setpts=${videoSpeed}*PTS[v];[0:a]atempo=${audioSpeed}[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async adjustBrightness(videoUrl: string, brightness: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    // Convert brightness from -100/100 to 0-2 range for FFmpeg
    const brightnessValue = (brightness + 100) / 100;
    
    const args = [
      '-i', inputPath,
      '-vf', `eq=brightness=${brightnessValue - 1}`,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async addText(
    videoUrl: string, 
    text: string, 
    position: 'top' | 'center' | 'bottom',
    startTime?: number,
    endTime?: number
  ): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    let yPosition = 'h-th-10'; // bottom
    if (position === 'top') yPosition = '10';
    if (position === 'center') yPosition = '(h-th)/2';
    
    let filterString = `drawtext=text='${text}':fontcolor=white:fontsize=24:x=(w-tw)/2:y=${yPosition}`;
    
    if (startTime !== undefined && endTime !== undefined) {
      filterString += `:enable='between(t,${startTime},${endTime})'`;
    }
    
    const args = [
      '-i', inputPath,
      '-vf', filterString,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async cropVideo(videoUrl: string, x: number, y: number, width: number, height: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    const args = [
      '-i', inputPath,
      '-vf', `crop=${width}:${height}:${x}:${y}`,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async rotateVideo(videoUrl: string, degrees: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    let transposeValue = '1'; // 90 degrees clockwise
    if (degrees === 180) transposeValue = '2,transpose=2';
    if (degrees === 270) transposeValue = '2';
    
    const args = [
      '-i', inputPath,
      '-vf', `transpose=${transposeValue}`,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async adjustVolume(videoUrl: string, volume: number): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    const args = [
      '-i', inputPath,
      '-af', `volume=${volume}`,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }

  async applyFilter(videoUrl: string, filter: string, intensity: number = 1): Promise<string> {
    const inputPath = await this.downloadVideo(videoUrl);
    const outputPath = this.generateOutputPath();
    
    let filterString = '';
    
    switch (filter) {
      case 'grayscale':
        filterString = 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3';
        break;
      case 'sepia':
        filterString = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
        break;
      case 'blur':
        filterString = `gblur=sigma=${intensity * 2}`;
        break;
      case 'sharpen':
        filterString = `unsharp=5:5:${intensity}:5:5:0`;
        break;
      default:
        throw new Error(`Unknown filter: ${filter}`);
    }
    
    const args = [
      '-i', inputPath,
      '-vf', filterString,
      '-y',
      outputPath
    ];
    
    await this.runFFmpeg(args);
    
    const resultUrl = await this.uploadToVercelBlob(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    
    return resultUrl;
  }
}

export const videoProcessor = new VideoProcessor(); 