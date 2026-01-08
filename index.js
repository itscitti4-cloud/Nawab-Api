const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// Database Schema
const BabySchema = new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
});
const Baby = mongoose.model('babies', BabySchema);

// --- AI Response Function (যদি ডাটাবেজে উঃ না থাকে) ---
async function getAIResponse(question) {
    try {
        // Dipto API বা অন্য কোনো AI API ব্যবহার করা হচ্ছে
        const response = await axios.get(`https://noobs-api.top/dipto/gemini?prompt=${encodeURIComponent(question)}`);
        return response.data.reply || "I am confused right now!";
    } catch (error) {
        return "I don't know the answer and I'm having trouble connecting to my brain (AI).";
    }
}

// --- API Endpoints ---

// 1. Chat Response (Database + AI Backup)
app.get('/api/bby', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.json({ error: "Please provide text! Example: /api/bby?text=hello" });

    const results = await Baby.find({ ask: text.toLowerCase() });
    
    if (results.length > 0) {
        const randomAns = results[Math.floor(Math.random() * results.length)];
        res.json({ reply: randomAns.ans, source: "database" });
    } else {
        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "AI" });
    }
});

// 2. Teach (বটকে শেখানো)
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Provide both 'ask' and 'ans'!" });

    const newData = new Baby({ ask, ans, teacher: teacher || "Unknown" });
    await newData.save();
    res.json({ status: "success", message: "Teach successful!", data: { ask, ans, teacher: teacher || "Unknown" } });
});

// 3. Remove (ডাটা রিমুভ করা)
app.get('/api/bby/remove', async (req, res) => {
    const { ask, ans } = req.query;
    const result = await Baby.deleteOne({ ask: ask.toLowerCase(), ans: ans });
    if (result.deletedCount > 0) {
        res.json({ status: "success", message: "Data removed!" });
    } else {
        res.json({ status: "failed", message: "No matching data found to remove." });
    }
});

// 4. Total (মোট ডাটা সংখ্যা)
app.get('/api/bby/total', async (req, res) => {
    const count = await Baby.countDocuments();
    res.json({ total_commands: count });
});

// 5. List (সব টিচারের লিস্ট)
app.get('/api/bby/list', async (req, res) => {
    const list = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ teachers: list });
});

// 6. Top 10 (সেরা ১০ টিচার)
app.get('/api/bby/top', async (req, res) => {
    const topTeachers = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ top_10_teachers: topTeachers });
});

// Root Route
app.get('/', (req, res) => {
    res.json({ message: "Welcome to NAWAB-API", endpoints: ["/api/bby", "/api/bby/teach", "/api/bby/total", "/api/bby/list", "/api/bby/top"] });
});

app.listen(PORT, () => console.log(`🚀 NAWAB-API is running on port ${PORT}`));
        
