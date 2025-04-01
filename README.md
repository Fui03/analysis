## 🛠️ Setup Instructions

### 🔹 Backend (FastAPI)
1. **Navigate to backend folder**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:

   ```bash
   python -m venv venv
   source venv/bin/activate        # On macOS/Linux
   venv\Scripts\activate           # On Windows
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Create a `.env` file** in the `backend/` folder and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=your-openai-key-here
   ```

5. **Run the FastAPI server**:

   ```bash
   uvicorn main:app --reload --port 5000
   ```

---

### 🔹 Frontend (React)

1. **Navigate to the frontend folder**:

   ```bash
   cd frontend/myapp
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the React development server**:

   ```bash
   npm start
   ```

---

### ✅ Result

- Frontend available at: [http://localhost:3000](http://localhost:3000)
- Backend API running at: [http://localhost:5000](http://localhost:5000)

