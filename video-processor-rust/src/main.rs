use axum::{
    extract::Json,
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    process::{Command, Stdio},
    time::Instant,
};
use tempfile::TempDir;
use tokio::fs;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing::{info, error};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct VideoProcessRequest {
    video_url: String,
    operation: String,
    parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BatchProcessRequest {
    video_url: String,
    operations: Vec<Operation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Operation {
    #[serde(rename = "type")]
    op_type: String,
    parameters: HashMap<String, serde_json::Value>,
    order: u32,
}

#[derive(Debug, Serialize)]
struct ProcessResponse {
    success: bool,
    video_url: Option<String>,
    error: Option<String>,
    processing_time_ms: u64,
    operation: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    ffmpeg_available: bool,
    version: String,
}

struct VideoProcessor {
    temp_dir: TempDir,
}

impl VideoProcessor {
    fn new() -> anyhow::Result<Self> {
        let temp_dir = tempfile::tempdir()?;
        Ok(Self { temp_dir })
    }

    async fn download_video(&self, url: &str) -> anyhow::Result<String> {
        let response = reqwest::get(url).await?;
        let bytes = response.bytes().await?;
        
        let file_id = Uuid::new_v4();
        let input_path = self.temp_dir.path().join(format!("input_{}.mp4", file_id));
        
        fs::write(&input_path, bytes).await?;
        Ok(input_path.to_string_lossy().to_string())
    }

    async fn upload_to_vercel_blob(&self, file_path: &str) -> anyhow::Result<String> {
        // Create a public directory if it doesn't exist
        let public_dir = std::path::Path::new("public/processed");
        if !public_dir.exists() {
            fs::create_dir_all(public_dir).await?;
        }
        
        let file_name = std::path::Path::new(file_path)
            .file_name()
            .unwrap()
            .to_string_lossy();
        
        // Generate a unique filename to avoid conflicts
        let unique_filename = format!("{}_{}", Uuid::new_v4(), file_name);
        let destination = public_dir.join(&unique_filename);
        
        // Copy the processed file to the public directory
        fs::copy(file_path, &destination).await?;
        
        // Return a URL that can be accessed (adjust the base URL as needed)
        let public_url = format!("http://localhost:3001/public/processed/{}", unique_filename);
        
        info!("Processed video saved to: {}", public_url);
        Ok(public_url)
    }

    fn run_ffmpeg(&self, args: &[&str]) -> anyhow::Result<String> {
        let start = Instant::now();
        
        let output = Command::new("ffmpeg")
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()?;

        let duration = start.elapsed();
        info!("FFmpeg completed in {:?}", duration);

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("FFmpeg failed: {}", stderr);
            return Err(anyhow::anyhow!("FFmpeg failed: {}", stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    }

    async fn process_single_operation(
        &self,
        input_path: &str,
        operation: &str,
        parameters: &HashMap<String, serde_json::Value>,
    ) -> anyhow::Result<String> {
        let output_id = Uuid::new_v4();
        let output_path = self.temp_dir.path().join(format!("output_{}.mp4", output_id));
        let output_str = output_path.to_string_lossy();

        let mut args = vec!["-i", input_path];

        // Declare filter strings outside their scopes to fix lifetime issues
        let brightness_filter;
        let video_filter;
        let audio_filter;
        let start_time_str;
        let duration_str;
        let crop_filter;
        let text_filter;

        match operation {
            "adjustBrightness" => {
                let brightness = parameters.get("brightness")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0) / 100.0;
                
                brightness_filter = format!("eq=brightness={}", brightness);
                args.extend(&["-vf", &brightness_filter]);
            }
            "adjustSpeed" => {
                let speed = parameters.get("speed")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0);
                
                video_filter = format!("setpts={}*PTS", 1.0 / speed);
                audio_filter = format!("atempo={}", speed);
                args.extend(&["-vf", &video_filter]);
                args.extend(&["-af", &audio_filter]);
            }
            "trimVideo" => {
                let start_time = parameters.get("startTime")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let end_time = parameters.get("endTime")
                    .and_then(|v| v.as_f64());
                
                start_time_str = start_time.to_string();
                args.extend(&["-ss", &start_time_str]);
                if let Some(end) = end_time {
                    duration_str = (end - start_time).to_string();
                    args.extend(&["-t", &duration_str]);
                }
            }
            "cropVideo" => {
                let x = parameters.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
                let y = parameters.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
                let width = parameters.get("width").and_then(|v| v.as_i64()).unwrap_or(1920);
                let height = parameters.get("height").and_then(|v| v.as_i64()).unwrap_or(1080);
                
                crop_filter = format!("crop={}:{}:{}:{}", width, height, x, y);
                args.extend(&["-vf", &crop_filter]);
            }
            "addText" => {
                let text = parameters.get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Sample Text");
                let position = parameters.get("position")
                    .and_then(|v| v.as_str())
                    .unwrap_or("center");
                
                let y_pos = match position {
                    "top" => "50",
                    "bottom" => "h-th-50",
                    _ => "(h-th)/2", // center
                };
                
                text_filter = format!("drawtext=text='{}':fontcolor=white:fontsize=24:x=(w-tw)/2:y={}", text, y_pos);
                args.extend(&["-vf", &text_filter]);
            }
            "applyFilter" => {
                let filter = parameters.get("filter")
                    .and_then(|v| v.as_str())
                    .unwrap_or("cinematic");
                
                match filter {
                    "cinematic" => {
                        args.extend(&["-vf", "eq=contrast=1.2:brightness=0.1:saturation=1.1,curves=all='0/0 0.5/0.58 1/1'"]);
                    }
                    "vintage" => {
                        args.extend(&["-vf", "eq=contrast=0.9:brightness=0.05:saturation=0.8,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"]);
                    }
                    _ => {
                        args.extend(&["-vf", "eq=contrast=1.1:brightness=0.05"]);
                    }
                }
            }
            _ => {
                return Err(anyhow::anyhow!("Unsupported operation: {}", operation));
            }
        }

        args.extend(&["-y", &output_str]);

        self.run_ffmpeg(&args)?;
        Ok(output_str.to_string())
    }

    async fn process_batch_operations(
        &self,
        input_path: &str,
        operations: &[Operation],
    ) -> anyhow::Result<String> {
        let mut current_input = input_path.to_string();
        
        // Sort operations by order
        let mut sorted_ops = operations.to_vec();
        sorted_ops.sort_by_key(|op| op.order);

        for operation in sorted_ops {
            let output = self.process_single_operation(
                &current_input,
                &operation.op_type,
                &operation.parameters,
            ).await?;
            
            // Clean up intermediate file if it's not the original input
            if current_input != input_path {
                let _ = fs::remove_file(&current_input).await;
            }
            
            current_input = output;
        }

        Ok(current_input)
    }
}

async fn health_check() -> ResponseJson<HealthResponse> {
    let ffmpeg_available = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_ok();

    ResponseJson(HealthResponse {
        status: "healthy".to_string(),
        ffmpeg_available,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn process_video(
    Json(request): Json<VideoProcessRequest>,
) -> Result<ResponseJson<ProcessResponse>, StatusCode> {
    let start_time = Instant::now();
    
    info!("Processing video: {} with operation: {}", request.video_url, request.operation);

    let processor = match VideoProcessor::new() {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to create processor: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(e.to_string()),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: request.operation,
            }));
        }
    };

    // Download video
    let input_path = match processor.download_video(&request.video_url).await {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to download video: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to download video: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: request.operation,
            }));
        }
    };

    // Process video
    let output_path = match processor.process_single_operation(
        &input_path,
        &request.operation,
        &request.parameters,
    ).await {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to process video: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to process video: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: request.operation,
            }));
        }
    };

    // Upload result
    let result_url = match processor.upload_to_vercel_blob(&output_path).await {
        Ok(url) => url,
        Err(e) => {
            error!("Failed to upload result: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to upload result: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: request.operation,
            }));
        }
    };

    let processing_time = start_time.elapsed().as_millis() as u64;
    info!("Video processing completed in {}ms", processing_time);

    Ok(ResponseJson(ProcessResponse {
        success: true,
        video_url: Some(result_url),
        error: None,
        processing_time_ms: processing_time,
        operation: request.operation,
    }))
}

async fn process_batch(
    Json(request): Json<BatchProcessRequest>,
) -> Result<ResponseJson<ProcessResponse>, StatusCode> {
    let start_time = Instant::now();
    
    info!("Processing batch operations for video: {}", request.video_url);

    let processor = match VideoProcessor::new() {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to create processor: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(e.to_string()),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: "batch".to_string(),
            }));
        }
    };

    // Download video
    let input_path = match processor.download_video(&request.video_url).await {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to download video: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to download video: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: "batch".to_string(),
            }));
        }
    };

    // Process batch operations
    let output_path = match processor.process_batch_operations(&input_path, &request.operations).await {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to process batch operations: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to process batch operations: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: "batch".to_string(),
            }));
        }
    };

    // Upload result
    let result_url = match processor.upload_to_vercel_blob(&output_path).await {
        Ok(url) => url,
        Err(e) => {
            error!("Failed to upload result: {}", e);
            return Ok(ResponseJson(ProcessResponse {
                success: false,
                video_url: None,
                error: Some(format!("Failed to upload result: {}", e)),
                processing_time_ms: start_time.elapsed().as_millis() as u64,
                operation: "batch".to_string(),
            }));
        }
    };

    let processing_time = start_time.elapsed().as_millis() as u64;
    info!("Batch processing completed in {}ms", processing_time);

    Ok(ResponseJson(ProcessResponse {
        success: true,
        video_url: Some(result_url),
        error: None,
        processing_time_ms: processing_time,
        operation: "batch".to_string(),
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    // Create public directory if it doesn't exist
    let public_dir = std::path::Path::new("public/processed");
    if !public_dir.exists() {
        std::fs::create_dir_all(public_dir)?;
    }

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/process", post(process_video))
        .route("/batch", post(process_batch))
        .nest_service("/public", ServeDir::new("public"))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Video processor server running on http://0.0.0.0:3001");

    axum::serve(listener, app).await?;

    Ok(())
}
