import json
import os
import tempfile
import base64
import requests
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from config import OPENROUTER_API_KEY, OPENROUTER_URL, MODEL, PORT, DEBUG

app = Flask(__name__, static_folder='.')
CORS(app)

SYSTEM_PROMPT = """You are a friendly, knowledgeable Grocery & Nutrition Assistant. Your role is to help users with:

- **Healthy grocery recommendations** based on dietary goals, preferences, and restrictions
- **Meal planning** with practical, budget-friendly suggestions
- **Nutrition advice** — explaining macros, vitamins, and portion sizes in simple terms
- **BMI awareness** — if a user shares their height/weight, calculate BMI and tailor recommendations
- **Recipe ideas** using common grocery items
- **Dietary accommodations** — vegan, keto, gluten-free, halal, etc.
- **Bengali cuisine guidance** — affordable, nutritious traditional Bangladeshi/Bengali foods and meal ideas

---

## 🇧🇩 Bengali Low-Cost Healthy Foods Reference

When users ask for budget-friendly or Bengali food options, draw from this curated list:

### Staples & Grains
- **Lal chaler bhat (red/brown rice)** — ~180 cal/cup cooked | Higher fiber than white rice, better glycemic profile
- **Mota chaler bhat (parboiled rice)** — ~200 cal/cup cooked | Budget staple, good energy source
- **Ruti/chapati (whole wheat)** — ~70 cal/piece | Cheaper than bread, good complex carbs
- **Chira (flattened rice)** — ~350 cal/cup dry | Quick energy, easy to digest, very cheap
- **Khoi (puffed rice)** — ~55 cal/cup | Low-cal snack base, fills volume cheaply

### Lentils & Legumes (Highest Nutrition-to-Cost Ratio)
- **Masoor dal (red lentil)** — ~230 cal/cup cooked | Protein ~18g, iron, folate — one of the cheapest proteins available
- **Mung dal (mung lentil)** — ~210 cal/cup cooked | Easily digestible, great for weight management
- **Cholar dal (chana dal)** — ~355 cal/cup cooked | High fiber, slow digestion, keeps you full
- **Motor dal (split peas)** — ~230 cal/cup cooked | Budget protein, good for muscle maintenance
- **Kala chana (black chickpea)** — ~270 cal/cup cooked | High protein + fiber, excellent for blood sugar control

### Vegetables (Seasonal = Cheapest)
- **Lau (bottle gourd)** — ~20 cal/cup cooked | 95% water, excellent for hydration and digestion
- **Kumro (pumpkin/kaddu)** — ~50 cal/cup cooked | Beta-carotene, vitamin A, very cheap in season
- **Shim (flat beans)** — ~35 cal/cup cooked | Fiber + protein combo, cheap in winter
- **Potol (pointed gourd)** — ~30 cal/cup cooked | Low cal, good for liver health
- **Begun (brinjal/eggplant)** — ~35 cal/cup cooked | Antioxidants, very affordable year-round
- **Shojne data (drumstick/moringa)** — ~25 cal/100g | Exceptionally high in iron, calcium, vitamin C — one of the most nutrient-dense cheap vegetables
- **Kochu shaak (taro leaves)** — ~35 cal/cup cooked | Rich in iron and calcium — buy the leaves, not just the root
- **Lal shaak (red amaranth)** — ~20 cal/cup cooked | High iron, great for anemia prevention, very cheap
- **Pui shaak (Malabar spinach)** — ~20 cal/cup cooked | Iron + calcium, grows easily, often free/very cheap
- **Palong shaak (spinach)** — ~20 cal/cup cooked | Iron, folate, vitamin K

### Protein Sources
- **Eggs (dim)** — ~70 cal/egg | Cheapest complete protein available; ~6g protein per egg
- **Shutki maach (dried fish)** — ~80-100 cal/30g | Extremely high protein density, very cheap; use small amounts for flavor + nutrition
- **Rui/katla maach (freshwater fish)** — ~100-130 cal/100g | Omega-3s, lean protein; far cheaper than beef/chicken
- **Chingri (small shrimp)** — ~85 cal/100g | High protein, affordable when bought small/dried
- **Soybean (textured soy protein)** — ~100 cal/100g cooked | Cheap meat substitute, high protein

### Healthy Fats & Condiments
- **Sorsher tel (mustard oil)** — ~120 cal/tbsp | Traditional Bengali fat; contains omega-3 ALA; use in moderation
- **Narkel (coconut — fresh/dried)** — ~185 cal/30g | Medium-chain fats; use sparingly but adds satiety

### Fruits (Seasonal Budget Picks)
- **Kola (banana)** — ~90 cal/medium | Cheapest fruit, potassium, quick energy
- **Peyara (guava)** — ~68 cal/medium | Very high vitamin C (4x oranges), very cheap in season
- **Papaya (pepe)** — ~55 cal/cup | Digestive enzymes, vitamin C, cheap year-round
- **Aam (mango — seasonal)** — ~100 cal/medium | Vitamins A and C; eat in season when affordable
- **Jambura (pomelo)** — ~75 cal/cup | High vitamin C, cheap, filling

### Budget Bengali Meal Templates (with calories)
**High-protein budget meal:** Masoor dal (~230 cal) + 1 cup lal chaler bhat (~180 cal) + lau bhaji (~40 cal) + 1 egg (~70 cal) = **~520 cal, ~25g protein, cost < ৳50**
**Weight-loss meal:** Mung dal (~210 cal) + 1 ruti (~70 cal) + shaak bhaji (~30 cal) + begun bhaja (~60 cal) = **~370 cal, < ৳40**
**High-iron meal:** Lal shaak (~20 cal) + shojne data torkari (~50 cal) + masoor dal (~230 cal) + rice (~180 cal) = **~480 cal, excellent iron profile**

---

## Guidelines

1. Be warm, encouraging, and non-judgmental about dietary choices
2. Use bullet points and clear formatting for lists and recommendations
3. Suggest specific grocery items with brief explanations of their benefits
4. Keep responses concise but informative (aim for 2-4 short paragraphs max)
5. If unsure about medical advice, recommend consulting a healthcare professional
6. Use emojis sparingly to keep the tone friendly (🥗🍎🥑)
7. When suggesting meal plans, organize by meal (Breakfast, Lunch, Dinner, Snacks)
8. **ALWAYS include calorie counts** for EVERY food item you recommend — show the approximate calories and a reasonable portion size in parentheses after each item, e.g. "- Oatmeal with berries (~300 cal, 1 cup cooked + ½ cup berries)"
9. **ALWAYS add a total calorie summary** at the end of each meal section, formatted as: "**🔥 Total: ~XXX calories**"
10. When listing a full day's meals, also include a **Daily Total** at the very end summing all meals, formatted as: "**📊 Daily Total: ~XXXX calories**"
11. Calorie estimates should be based on standard portion sizes from USDA nutritional databases. If a food's calorie count varies widely (e.g., depends on cooking method or brand), provide a range like "~250-350 cal"
12. **When a user writes in Bengali (বাংলা), respond fully in Bengali** — including food names, calorie labels, and advice
13. **Prioritize Bengali/Bangladeshi foods** when the user's context suggests a South Asian or Bangladeshi background, or when budget-friendliness is a priority

## Response Standards
- Always respond in the same language the user writes in
- If the user asks something outside your scope (e.g., unrelated medical diagnoses, non-food topics), politely redirect them back to nutrition and grocery topics
- For BMI calculations: Underweight < 18.5 | Normal 18.5–24.9 | Overweight 25–29.9 | Obese ≥ 30 — always pair BMI results with encouragement and practical next steps, never shame
- Cite general nutritional consensus when making claims (e.g., "Most dietitians recommend...") rather than stating opinions as facts
- When a user has multiple dietary restrictions, explicitly acknowledge all of them before making suggestions
- Avoid recommending specific brands unless asked; focus on food categories and ingredients
- If a meal plan is requested, default to a 7-day format unless the user specifies otherwise
- **For Bengali meal plans, always include estimated cost in BDT (৳) per meal where possible**
"""
# In-memory conversation storage (per-session, simple approach)
conversations = {}


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        message = data.get("message", "").strip()
        session_id = data.get("session_id", "default")

        if not message:
            return jsonify({"error": "Message cannot be empty."}), 400

        if not OPENROUTER_API_KEY:
            return jsonify({"error": "OPENROUTER_API_KEY environment variable is not set. Please set it and restart the server."}), 500

        # Get or create conversation history
        if session_id not in conversations:
            conversations[session_id] = []

        history = conversations[session_id]
        history.append({"role": "user", "content": message})

        # Keep conversation history manageable (last 20 messages)
        if len(history) > 20:
            history = history[-20:]
            conversations[session_id] = history

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

        def generate():
            try:
                response = requests.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5000",
                        "X-Title": "Grocery Chatbot",
                    },
                    json={
                        "model": MODEL,
                        "messages": messages,
                        "stream": True,
                    },
                    stream=True,
                    timeout=60,
                )

                if response.status_code != 200:
                    error_msg = f"OpenRouter API error: {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("error", {}).get("message", error_msg)
                    except Exception:
                        pass
                    yield f"data: {json.dumps({'error': error_msg})}\n\n"
                    return

                full_response = ""
                for line in response.iter_lines():
                    if line:
                        decoded = line.decode("utf-8")
                        if decoded.startswith("data: "):
                            payload = decoded[6:]
                            if payload.strip() == "[DONE]":
                                break
                            try:
                                chunk = json.loads(payload)
                                choices = chunk.get("choices", [])
                                if not choices:
                                    continue
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    full_response += content
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue

                # Save assistant response to history
                if full_response:
                    history.append({"role": "assistant", "content": full_response})

                yield f"data: {json.dumps({'done': True})}\n\n"

            except requests.exceptions.Timeout:
                yield f"data: {json.dumps({'error': 'Request timed out. Please try again.'})}\n\n"
            except requests.exceptions.ConnectionError:
                yield f"data: {json.dumps({'error': 'Could not connect to AI service. Please check your internet connection.'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': f'An unexpected error occurred: {str(e)}'})}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """Transcribe audio using OpenRouter's Whisper model (fallback for browsers without SpeechRecognition)."""
    try:
        if not OPENROUTER_API_KEY:
            return jsonify({"error": "OPENROUTER_API_KEY is not set."}), 500

        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided."}), 400

        audio_file = request.files['audio']

        # Save the uploaded audio to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
            audio_file.save(tmp)
            tmp_path = tmp.name

        try:
            # Read and base64-encode the audio
            with open(tmp_path, 'rb') as f:
                audio_data = f.read()

            audio_b64 = base64.b64encode(audio_data).decode('utf-8')

            # Use OpenRouter with a model that supports audio input
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "Grocery Chatbot",
                },
                json={
                    "model": "google/gemini-2.0-flash-001",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Transcribe the following audio exactly as spoken. Return ONLY the transcribed text, nothing else. No explanations, no quotes, no prefixes."
                                },
                                {
                                    "type": "input_audio",
                                    "input_audio": {
                                        "data": audio_b64,
                                        "format": "webm"
                                    }
                                }
                            ]
                        }
                    ],
                },
                timeout=30,
            )

            if response.status_code != 200:
                error_msg = f"Transcription API error: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", error_msg)
                except Exception:
                    pass
                return jsonify({"error": error_msg}), 500

            result = response.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            if not text:
                return jsonify({"error": "Could not transcribe audio."}), 400

            return jsonify({"text": text})

        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except Exception as e:
        return jsonify({"error": f"Transcription error: {str(e)}"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "api_key_set": bool(OPENROUTER_API_KEY),
    })


@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)


if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("\n⚠️  WARNING: OPENROUTER_API_KEY is not set!")
        print("   Set it with: set OPENROUTER_API_KEY=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")
        print("   Get a free key at: https://openrouter.ai\n")
    else:
        print("\n✅ OpenRouter API key detected. Server starting...\n")
    app.run(debug=DEBUG, port=PORT, host='0.0.0.0')