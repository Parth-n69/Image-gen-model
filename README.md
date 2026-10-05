# NeuralCanvas — AI Image Generator

Generate stunning images from text prompts using **Stable Diffusion XL** via the Hugging Face Inference API. Built with a Flask backend and vanilla HTML/CSS/JS frontend.

![Python](https://img.shields.io/badge/Python-3.9+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey?logo=flask)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🗂️ Project Structure

```
image-gen-model/
├── backend/
│   ├── app.py              # Flask API server
│   ├── .env                # Your Hugging Face API key (not committed)
│   ├── .env.example        # Template for .env
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Main UI page
│   ├── style.css           # Dark-theme styles
│   ├── script.js           # Client-side logic (generation, gallery, lightbox)
│   └── storage.js          # IndexedDB storage module for generation history
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.9+** installed
- A free **Hugging Face** account → [huggingface.co](https://huggingface.co/)
- A **Hugging Face API token** (read access is enough)
  1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
  2. Create a new token with **Read** permissions
  3. Copy the token

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Image-gen-model.git
cd Image-gen-model
```

### 2. Set Up the Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Add Your Hugging Face Token

Open `backend/.env` and replace the placeholder:

```
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Never commit your real API key.** The `.env` file should be in `.gitignore`.

### 4. Start the Flask Server

```bash
# From the backend/ directory with venv activated
python app.py
```

The server will start at **http://127.0.0.1:5000**.

### 5. Open the Frontend

Simply open `frontend/index.html` in your browser:

- **Option A:** Double-click the file in your file explorer
- **Option B:** Use Live Server in VS Code
- **Option C:** Run `start frontend/index.html` (Windows) or `open frontend/index.html` (macOS)

---

## 🎨 Usage

### Generating Images

1. Type a descriptive prompt (e.g., *"A cyberpunk city at sunset, neon lights, ultra detailed"*)
2. (Optional) Open the **Options** panel to select:
   - **Style Preset:** Quickly apply a specific artistic style (e.g., Anime, Realistic Photo).
   - **Aspect Ratio:** Choose between Square, Portrait, or Landscape.
   - **Negative Prompt:** Specify things to avoid in the generation (e.g., "blurry, distorted").
3. Click **Generate** (or press Enter)
4. Wait 10-30 seconds (longer on cold starts when the model is loading)
5. View and **download** your generated image as a PNG

### Image Editing

The new **Edit Tab** allows you to modify your existing images or generated creations:
1. Upload an image, drag-and-drop one, or click **"Edit this image"** on any generated result in the chat or gallery.
2. **AI Magic Edit:** Describe the change (e.g. "make it winter") and apply it using models like FLUX Kontext.
   > ⚠️ **Note:** AI edits use the Hugging Face Inference API which consumes your limited free account credits. If your credits run out, the AI edit will fail.
3. **Basic Tools:** You can always use the built-in basic tools—these run entirely in your browser and work even if AI credits are exhausted:
   - Rotate, flip
   - Adjust Brightness, Contrast, Saturation, Blur
   - Apply filters (Grayscale, Sepia, Invert)
4. Compare your edits with the original image using the **Compare (Hold)** button.
5. Save your edits directly to the Gallery (they will appear with an "Edited" badge) or download them.

### Generation History & Gallery

Every successful generation is **automatically saved** to your browser's IndexedDB storage (which can hold hundreds of images, unlike localStorage).

- **Gallery Tab:** Switch to the Gallery tab to browse all your past generations in a responsive grid layout.
- **Favorites:** Star ⭐ any image to mark it as a favorite. Use the "Favorites" filter to view only starred images.
- **Lightbox:** Click any gallery image to open a detailed view showing the full image and all generation settings (prompt, negative prompt, model, style, size).
- **Reuse Settings:** In the lightbox, click "Reuse Settings" to copy all settings from a past generation back into the Generate tab — perfect for iterating on a concept.
- **Delete:** Remove individual images (with confirmation), or use "Clear All" to remove all history (favorites are kept by default).
- **Download:** Download any image from the gallery or lightbox.

### Storage

- Images are stored in **IndexedDB** (not localStorage), which can handle hundreds of large base64 images.
- If IndexedDB is unavailable (e.g., in private browsing), the app still works — you just won't have persistent history. A warning toast will appear.
- Data is stored locally in your browser only. Clearing browser data will remove your history.

---

## ⚠️ Notes

- **Cold starts:** The Stable Diffusion XL model on Hugging Face's free tier may take 30-60 seconds to load on the first request. Subsequent requests are faster.
- **Rate limits:** The free Hugging Face API has rate limits. If you hit them, wait a moment and try again.
- **Image quality:** For better results, use detailed, descriptive prompts.

---

## 🛠️ Tech Stack

| Layer    | Technology                                      |
|----------|------------------------------------------------|
| Frontend | HTML5, CSS3, vanilla JavaScript                 |
| Storage  | IndexedDB (via `storage.js` module)             |
| Backend  | Python, Flask, flask-cors                       |
| AI Model | Stable Diffusion XL (via Hugging Face API)      |
| Styling  | Custom dark theme with glassmorphism & animations|

---

## 📄 License

This project is open source under the [MIT License](LICENSE).
