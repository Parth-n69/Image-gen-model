import os
import base64
import io
from datetime import date
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

app = Flask(__name__)
CORS(app)

HF_API_KEY = os.getenv("HF_API_KEY")

# ── Supported models ───────────────────────────────────────────
MODELS = {
    "flux-schnell": "black-forest-labs/FLUX.1-schnell",
    "flux-dev":     "black-forest-labs/FLUX.1-dev",
    "sd3.5":        "stabilityai/stable-diffusion-3.5-large",
    "sdxl":         "stabilityai/stable-diffusion-xl-base-1.0",
}
DEFAULT_MODEL = "flux-schnell"

# ── Daily rate-limiting config ─────────────────────────────────
DAILY_LIMIT = 4

# In-memory store: { "ip_address": { "date": "YYYY-MM-DD", "count": int } }
usage_tracker = {}


def _get_usage(ip):
    """Return the usage record for an IP, resetting if the date has changed."""
    today = date.today().isoformat()
    record = usage_tracker.get(ip)

    if record is None or record["date"] != today:
        usage_tracker[ip] = {"date": today, "count": 0}

    return usage_tracker[ip]


@app.route("/status", methods=["GET"])
def get_status():
    """Return the remaining daily credits for the requesting IP."""
    ip = request.remote_addr
    record = _get_usage(ip)
    remaining = max(0, DAILY_LIMIT - record["count"])

    return jsonify({
        "daily_limit": DAILY_LIMIT,
        "used": record["count"],
        "remaining": remaining,
        "models": list(MODELS.keys()),
    }), 200


@app.route("/generate", methods=["POST"])
def generate_image():
    """Generate an image from a text prompt using a selected HF model."""

    ip = request.remote_addr
    record = _get_usage(ip)

    # ── Check daily limit ──────────────────────────────────────
    if record["count"] >= DAILY_LIMIT:
        return jsonify({
            "error": "Your daily token has expired. You have used all 4 free image generations for today. Please try again tomorrow.",
            "code": "TOKEN_EXPIRED",
            "remaining": 0,
        }), 429

    # ── Validate request body ──────────────────────────────────
    data = request.get_json(silent=True)
    if not data or not data.get("prompt", "").strip():
        return jsonify({"error": "Prompt is required and cannot be empty."}), 400

    prompt = data["prompt"].strip()

    # ── Validate model selection ───────────────────────────────
    model_key = data.get("model", DEFAULT_MODEL).strip()
    if model_key not in MODELS:
        return jsonify({
            "error": f"Invalid model '{model_key}'. Available models: {', '.join(MODELS.keys())}",
            "available_models": list(MODELS.keys()),
        }), 400

    hf_model_id = MODELS[model_key]

    # ── Extract Phase 1 parameters ─────────────────────────────
    negative_prompt = data.get("negative_prompt", "").strip()
    
    try:
        width = int(data.get("width", 1024))
    except (ValueError, TypeError):
        width = 1024
        
    try:
        height = int(data.get("height", 1024))
    except (ValueError, TypeError):
        height = 1024

    if not (512 <= width <= 1536):
        return jsonify({"error": "width must be between 512 and 1536"}), 400
    if not (512 <= height <= 1536):
        return jsonify({"error": "height must be between 512 and 1536"}), 400

    # ── Validate API key is configured ─────────────────────────
    if not HF_API_KEY:
        return jsonify({"error": "Server misconfiguration: Hugging Face API key is not set."}), 500

    # ── Call Hugging Face via InferenceClient ───────────────────
    client = InferenceClient(token=HF_API_KEY)

    try:
        kwargs = {"width": width, "height": height}
        if negative_prompt:
            kwargs["negative_prompt"] = negative_prompt
            
        try:
            image = client.text_to_image(prompt, model=hf_model_id, **kwargs)
        except Exception:
            # Fallback if model doesn't support width/height/negative_prompt
            image = client.text_to_image(prompt, model=hf_model_id)
            
    except Exception as exc:
        error_msg = str(exc)

        # Model loading / cold start
        if "503" in error_msg or "loading" in error_msg.lower():
            return jsonify({
                "error": "The model is currently loading. Please try again in 30-60 seconds."
            }), 504

        # Permission / auth errors
        if "403" in error_msg or "permission" in error_msg.lower():
            return jsonify({
                "error": "API key does not have sufficient permissions. Please update your token."
            }), 403

        # Credits depleted
        if "402" in error_msg or "payment" in error_msg.lower() or "credits" in error_msg.lower():
            return jsonify({
                "error": "Hugging Face credits depleted. Please add credits or upgrade to PRO."
            }), 402

        # Connection errors
        if "connect" in error_msg.lower() or "resolve" in error_msg.lower():
            return jsonify({
                "error": "Could not connect to the Hugging Face API. Check your internet connection."
            }), 502

        return jsonify({"error": f"Image generation failed: {error_msg}"}), 500

    # ── Encode image to base64 data URI ────────────────────────
    try:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
        b64_string = base64.b64encode(buf.read()).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_string}"
    except Exception as exc:
        return jsonify({"error": f"Failed to process the generated image: {str(exc)}"}), 500

    # ── Increment usage AFTER successful generation ────────────
    record["count"] += 1
    remaining = max(0, DAILY_LIMIT - record["count"])

    return jsonify({
        "image": data_uri,
        "remaining": remaining,
        "daily_limit": DAILY_LIMIT,
        "model": model_key,
    }), 200


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
