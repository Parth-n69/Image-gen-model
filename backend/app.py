import os
import base64

import requests as http_requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

HF_API_KEY = os.getenv("HF_API_KEY")
HF_MODEL_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"


@app.route("/generate", methods=["POST"])
def generate_image():
    """Generate an image from a text prompt using Hugging Face Inference API."""

    # --- Validate request body ---
    data = request.get_json(silent=True)
    if not data or not data.get("prompt", "").strip():
        return jsonify({"error": "Prompt is required and cannot be empty."}), 400

    prompt = data["prompt"].strip()

    # --- Validate API key is configured ---
    if not HF_API_KEY:
        return jsonify({"error": "Server misconfiguration: Hugging Face API key is not set."}), 500

    # --- Call Hugging Face Inference API ---
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": prompt}

    try:
        response = http_requests.post(HF_MODEL_URL, headers=headers, json=payload, timeout=120)
    except http_requests.exceptions.Timeout:
        return jsonify({
            "error": "The model is taking too long to respond. It may be loading (cold start). Please try again in 30-60 seconds."
        }), 504
    except http_requests.exceptions.ConnectionError:
        return jsonify({"error": "Could not connect to the Hugging Face API. Check your internet connection."}), 502
    except http_requests.exceptions.RequestException as exc:
        return jsonify({"error": f"Unexpected request error: {str(exc)}"}), 500

    # --- Handle non-200 responses from HF ---
    if response.status_code != 200:
        # HF often returns JSON error bodies
        try:
            error_body = response.json()
        except ValueError:
            error_body = {"raw": response.text[:500]}

        # Model loading / estimated_time scenario (503)
        if response.status_code == 503:
            estimated = ""
            if isinstance(error_body, dict) and "estimated_time" in error_body:
                estimated = f" Estimated wait: {int(error_body['estimated_time'])}s."
            return jsonify({
                "error": f"The model is currently loading.{estimated} Please try again shortly."
            }), 504

        return jsonify({
            "error": f"Hugging Face API error (HTTP {response.status_code}).",
            "details": error_body,
        }), response.status_code

    # --- Validate response is actually an image ---
    content_type = response.headers.get("Content-Type", "")
    if "image" not in content_type:
        # HF sometimes returns 200 with a JSON body (e.g. queued status)
        try:
            body = response.json()
        except ValueError:
            body = {"raw": response.text[:500]}
        return jsonify({"error": "Expected an image but received a non-image response.", "details": body}), 502

    # --- Encode image bytes to base64 data URI ---
    try:
        image_bytes = response.content
        b64_string = base64.b64encode(image_bytes).decode("utf-8")
        data_uri = f"data:image/png;base64,{b64_string}"
    except Exception as exc:
        return jsonify({"error": f"Failed to process the generated image: {str(exc)}"}), 500

    return jsonify({"image": data_uri}), 200


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
