from flask import Flask, request, jsonify
from suggestion_engine import get_top_project_suggestions  # This returns list of tuples (title, similarity)
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow frontend requests from different origin

@app.route('/suggest-project-name', methods=['POST'])
def suggest_project_name():
    data = request.get_json()
    theme = data.get('theme', '').strip()
    tags = data.get('tags', '').strip()

    # Validate theme only (tags are optional)
    if not theme:
        return jsonify({'error': 'Theme is required'}), 400

    try:
        # Get list of (title, similarity) tuples
        suggestions = get_top_project_suggestions(theme, tags)

        # Convert to expected format: list of dicts with "projectTitle"
        suggested_names = [{'projectTitle': title} for title in suggestions]

        return jsonify({'suggested_project_names': suggested_names})
    except Exception as e:
        print("Error in suggestion engine:", e)
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(port=5001)